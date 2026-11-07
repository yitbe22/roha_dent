-- 0018 — One phone number can't hold two overlapping appointments online.
--
-- A dentist could already never be double-booked (exclusion constraint in 0002). This adds the
-- patient side: a website booking, or a patient moving their own booking with the manage link, is
-- refused with PATIENT_TIME_CONFLICT when the same patient (= phone number) already has an active
-- (pending/confirmed) appointment overlapping that time.
-- Staff bookings and staff moves are NOT blocked, so the front desk can still book several family
-- members who share one phone at the same time.

create or replace function public.appointments_patient_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('pending', 'confirmed') then return new; end if;
  if tg_op = 'INSERT' and new.source <> 'online' then return new; end if;
  if tg_op = 'UPDATE' and coalesce(current_setting('app.actor_type', true), '') <> 'patient' then return new; end if;

  if exists (
    select 1 from public.appointments a
     where a.patient_id = new.patient_id
       and a.id <> new.id
       and a.dentist_id <> new.dentist_id   -- same dentist: the exclusion constraint already refuses it
       and a.status in ('pending', 'confirmed')
       and a.starts_at < new.ends_at
       and a.ends_at   > new.starts_at
  ) then
    raise exception using errcode = 'P0001', message = 'PATIENT_TIME_CONFLICT';
  end if;
  return new;
end;
$$;

revoke execute on function public.appointments_patient_overlap() from public, anon, authenticated;

drop trigger if exists appointments_patient_overlap on public.appointments;
create trigger appointments_patient_overlap
  before insert or update of starts_at, ends_at on public.appointments
  for each row execute function public.appointments_patient_overlap();
