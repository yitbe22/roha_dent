-- 0004 — Availability and booking RPCs
--
-- Slot = a start time on the settings.slot_interval_minutes grid, inside a dentist's working
-- hours at the location, for the full service duration, minus time off, minus active
-- appointments of that dentist (at ANY location), and not earlier than now() + min_lead_minutes.
-- The pure-TypeScript mirror lives in packages/shared/src/slots.ts (unit-tested).
--
-- Error contract: business errors are raised with SQLSTATE P0001 and a stable MESSAGE key
-- (INVALID_PHONE, SLOT_UNAVAILABLE, ...) that Edge Functions map to user-facing text.

------------------------------------------------------------------------------
-- Internal: slot generator (not exposed)
------------------------------------------------------------------------------
create or replace function public._available_slots(
  p_location_id            uuid,
  p_service_id             uuid,
  p_date                   date,          -- clinic-local calendar date
  p_dentist_id             uuid default null,
  p_exclude_appointment_id uuid default null
)
returns table (dentist_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with cfg as (
    select s.slot_interval_minutes, s.min_lead_minutes, s.max_advance_days
    from public.settings s where s.id
  ),
  bounds as (
    select now() + make_interval(mins => cfg.min_lead_minutes)                         as earliest,
           (now() at time zone public.clinic_tz())::date + cfg.max_advance_days         as last_day,
           make_interval(mins => cfg.slot_interval_minutes)                            as step
    from cfg
  ),
  svc as (
    select s.id, make_interval(mins => s.duration_minutes) as dur
    from public.services s
    where s.id = p_service_id and s.is_active and s.is_bookable
  ),
  loc as (
    select l.id from public.locations l where l.id = p_location_id and l.is_active
  ),
  docs as (
    select d.id
    from public.dentists d
    join public.dentist_services ds on ds.dentist_id = d.id and ds.service_id = p_service_id
    where d.is_active and d.accepts_online_booking
      and (p_dentist_id is null or d.id = p_dentist_id)
  ),
  candidate as (
    select wh.dentist_id as c_dentist, gs as c_start, gs + svc.dur as c_end
    from public.working_hours wh
    join docs on docs.id = wh.dentist_id
    join loc  on loc.id  = wh.location_id
    cross join svc
    cross join bounds
    cross join lateral generate_series(
      (p_date + wh.start_time) at time zone public.clinic_tz(),
      ((p_date + wh.end_time) at time zone public.clinic_tz()) - svc.dur,
      bounds.step
    ) as gs
    where wh.weekday = extract(dow from p_date)::int
      and p_date <= bounds.last_day
  )
  select c.c_dentist, c.c_start, c.c_end
  from candidate c
  cross join bounds b
  where c.c_start >= b.earliest
    and not exists (
      select 1 from public.time_off t
      where t.during && tstzrange(c.c_start, c.c_end, '[)')
        and (   (t.dentist_id = c.c_dentist and (t.location_id is null or t.location_id = p_location_id))
             or (t.dentist_id is null and t.location_id = p_location_id))
    )
    and not exists (
      select 1 from public.appointments a
      where a.dentist_id = c.c_dentist
        and a.status in ('pending', 'confirmed')
        and a.during && tstzrange(c.c_start, c.c_end, '[)')
        and (p_exclude_appointment_id is null or a.id <> p_exclude_appointment_id)
    )
  order by c.c_start, c.c_dentist;
$$;

revoke execute on function public._available_slots(uuid, uuid, date, uuid, uuid) from public, anon, authenticated;

------------------------------------------------------------------------------
-- Public: slots for one day
------------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_location_id uuid,
  p_service_id  uuid,
  p_date        date,
  p_dentist_id  uuid default null
)
returns table (dentist_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.dentist_id, s.starts_at, s.ends_at
  from public._available_slots(p_location_id, p_service_id, p_date, p_dentist_id, null) s;
$$;

------------------------------------------------------------------------------
-- Public: which dates in a range have at least one slot (for the date picker)
------------------------------------------------------------------------------
create or replace function public.get_available_dates(
  p_location_id uuid,
  p_service_id  uuid,
  p_from        date,
  p_to          date,
  p_dentist_id  uuid default null
)
returns table (day date, slot_count int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception using errcode = 'P0001', message = 'INVALID_DATE_RANGE';
  end if;
  return query
    select d::date, (select count(*)::int
                     from public._available_slots(p_location_id, p_service_id, d::date, p_dentist_id, null))
    from generate_series(p_from, p_to, interval '1 day') d;
end;
$$;

grant execute on function public.get_available_slots(uuid, uuid, date, uuid) to anon, authenticated;
grant execute on function public.get_available_dates(uuid, uuid, date, date, uuid) to anon, authenticated;

------------------------------------------------------------------------------
-- Token helpers
------------------------------------------------------------------------------
-- 32 random bytes, base64url (43 chars, 256 bits)
create or replace function public._new_manage_token()
returns text
language sql
volatile
set search_path = ''
as $$ select translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_') $$;

create or replace function public._appointment_id_by_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.appointment_id from public.appointment_secrets s
  where p_token is not null and char_length(p_token) between 32 and 128 and s.manage_token = p_token
$$;

revoke execute on function public._new_manage_token(), public._appointment_id_by_token(text) from public, anon, authenticated;

------------------------------------------------------------------------------
-- Upsert patient by phone (internal)
------------------------------------------------------------------------------
create or replace function public._upsert_patient(p_phone text, p_full_name text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  v_id   uuid;
begin
  if p_phone is null or p_phone !~ '^\+2519[0-9]{8}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_PHONE';
  end if;
  if char_length(v_name) not between 2 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_NAME';
  end if;
  insert into public.patients (phone, full_name)
  values (p_phone, v_name)
  on conflict (phone) do update set full_name = excluded.full_name
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public._upsert_patient(text, text) from public, anon, authenticated;

------------------------------------------------------------------------------
-- Online booking — called ONLY by the create-booking Edge Function (service_role),
-- after Zod validation, Turnstile verification and rate limiting.
-- p_dentist_id null = "any available": least-booked dentist that day wins.
------------------------------------------------------------------------------
create or replace function public.book_appointment(
  p_location_id   uuid,
  p_service_id    uuid,
  p_dentist_id    uuid,
  p_starts_at     timestamptz,
  p_full_name     text,
  p_phone         text,
  p_patient_notes text default null
)
returns table (
  appointment_id uuid,
  manage_token   text,
  status         public.appointment_status,
  dentist_id     uuid,
  starts_at      timestamptz,
  ends_at        timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_cfg        public.settings;
  v_patient_id uuid;
  v_token      text;
  v_slot       record;
  v_status     public.appointment_status;
  v_id         uuid;
  v_active     int;
  v_notes      text := nullif(btrim(coalesce(p_patient_notes, '')), '');
  v_day        date := (p_starts_at at time zone public.clinic_tz())::date;
begin
  if p_starts_at is null then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception using errcode = 'P0001', message = 'INVALID_NOTES';
  end if;

  select * into v_cfg from public.settings s where s.id;
  v_patient_id := public._upsert_patient(p_phone, p_full_name);

  -- Serialize concurrent bookings by the same patient, then cap active future bookings.
  perform 1 from public.patients p where p.id = v_patient_id for update;
  select count(*) into v_active
  from public.appointments a
  where a.patient_id = v_patient_id and a.status in ('pending', 'confirmed') and a.starts_at > now();
  if v_active >= v_cfg.max_active_bookings_per_patient then
    raise exception using errcode = 'P0001', message = 'TOO_MANY_ACTIVE_BOOKINGS';
  end if;

  v_status := case when v_cfg.auto_confirm then 'confirmed'::public.appointment_status
                   else 'pending'::public.appointment_status end;
  v_token := public._new_manage_token();

  for v_slot in
    select s.dentist_id as d_id, s.starts_at as s_at, s.ends_at as e_at
    from public._available_slots(p_location_id, p_service_id, v_day, p_dentist_id, null) s
    where s.starts_at = p_starts_at
    order by (select count(*) from public.appointments a2
              where a2.dentist_id = s.dentist_id
                and a2.status in ('pending', 'confirmed')
                and (a2.starts_at at time zone public.clinic_tz())::date = v_day),
             random()
  loop
    begin
      insert into public.appointments (
        location_id, dentist_id, service_id, patient_id, starts_at, ends_at,
        status, source, patient_notes, confirmed_at)
      values (
        p_location_id, v_slot.d_id, p_service_id, v_patient_id, v_slot.s_at, v_slot.e_at,
        v_status, 'online', v_notes,
        case when v_status = 'confirmed' then now() end)
      returning id into v_id;
      insert into public.appointment_secrets (appointment_id, manage_token) values (v_id, v_token);

      appointment_id := v_id;
      manage_token   := v_token;
      status         := v_status;
      dentist_id     := v_slot.d_id;
      starts_at      := v_slot.s_at;
      ends_at        := v_slot.e_at;
      return next;
      return;
    exception when exclusion_violation then
      -- Lost a race for this dentist; try the next candidate.
      continue;
    end;
  end loop;

  raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
end;
$$;

revoke execute on function public.book_appointment(uuid, uuid, uuid, timestamptz, text, text, text)
  from public, anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, uuid, timestamptz, text, text, text)
  to service_role;

------------------------------------------------------------------------------
-- Patient self-service by token (manage-booking Edge Function, service_role)
------------------------------------------------------------------------------
create or replace function public._appointment_public_view(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',              a.id,
    'status',          a.status,
    'starts_at',       a.starts_at,
    'ends_at',         a.ends_at,
    'patient_first_name', split_part(p.full_name, ' ', 1),
    'service',  jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'duration_minutes', s.duration_minutes),
    'location', jsonb_build_object('id', l.id, 'slug', l.slug, 'name', l.name, 'phone', l.phone,
                                   'address', l.address, 'map_url', l.map_url),
    'dentist',  jsonb_build_object('id', d.id, 'full_name', d.full_name),
    'can_cancel',
        a.status in ('pending', 'confirmed')
        and a.starts_at > now() + make_interval(mins => cfg.cancel_cutoff_minutes),
    'can_reschedule',
        a.status in ('pending', 'confirmed')
        and a.starts_at > now() + make_interval(mins => cfg.cancel_cutoff_minutes)
        and a.reschedule_count < cfg.max_reschedules
  )
  from public.appointments a
  join public.patients  p on p.id = a.patient_id
  join public.services  s on s.id = a.service_id
  join public.locations l on l.id = a.location_id
  join public.dentists  d on d.id = a.dentist_id
  cross join (select * from public.settings where id) cfg
  where a.id = p_id;
$$;

create or replace function public.get_appointment_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_id uuid := public._appointment_id_by_token(p_token);
begin
  if v_id is null then return null; end if;
  return public._appointment_public_view(v_id);
end;
$$;

create or replace function public.cancel_appointment_by_token(p_token text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_cfg  public.settings;
begin
  if p_token is null or char_length(p_token) not between 32 and 128 then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select * into v_cfg from public.settings s where s.id;
  select * into v_appt from public.appointments a
  where a.id = public._appointment_id_by_token(p_token)
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_appt.status not in ('pending', 'confirmed')
     or v_appt.starts_at <= now() + make_interval(mins => v_cfg.cancel_cutoff_minutes) then
    raise exception using errcode = 'P0001', message = 'CANNOT_CANCEL';
  end if;

  perform set_config('app.actor_type', 'patient', true);
  update public.appointments a
     set status = 'cancelled',
         cancelled_by = 'patient',
         cancel_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 500)
   where a.id = v_appt.id;

  return public._appointment_public_view(v_appt.id);
end;
$$;

create or replace function public.reschedule_appointment_by_token(
  p_token      text,
  p_starts_at  timestamptz,
  p_dentist_id uuid default null   -- null = keep current dentist if free, else any available
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt   public.appointments;
  v_cfg    public.settings;
  v_slot   record;
  v_day    date := (p_starts_at at time zone public.clinic_tz())::date;
  v_status public.appointment_status;
begin
  if p_token is null or char_length(p_token) not between 32 and 128 then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select * into v_cfg from public.settings s where s.id;
  select * into v_appt from public.appointments a
  where a.id = public._appointment_id_by_token(p_token)
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_appt.status not in ('pending', 'confirmed')
     or v_appt.starts_at <= now() + make_interval(mins => v_cfg.cancel_cutoff_minutes)
     or v_appt.reschedule_count >= v_cfg.max_reschedules then
    raise exception using errcode = 'P0001', message = 'CANNOT_RESCHEDULE';
  end if;

  v_status := case when v_cfg.auto_confirm then 'confirmed'::public.appointment_status
                   else 'pending'::public.appointment_status end;
  perform set_config('app.actor_type', 'patient', true);

  for v_slot in
    select s.dentist_id as d_id, s.starts_at as s_at, s.ends_at as e_at
    from public._available_slots(v_appt.location_id, v_appt.service_id, v_day, p_dentist_id, v_appt.id) s
    where s.starts_at = p_starts_at
    order by (s.dentist_id = v_appt.dentist_id) desc, random()
  loop
    begin
      update public.appointments a
         set starts_at        = v_slot.s_at,
             ends_at          = v_slot.e_at,
             dentist_id       = v_slot.d_id,
             status           = v_status,
             confirmed_at     = case when v_status = 'confirmed' then now() else null end,
             reschedule_count = a.reschedule_count + 1
       where a.id = v_appt.id;
      return public._appointment_public_view(v_appt.id);
    exception when exclusion_violation then
      continue;
    end;
  end loop;

  raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
end;
$$;

revoke execute on function public._appointment_public_view(uuid) from public, anon, authenticated;
revoke execute on function public.get_appointment_by_token(text),
                           public.cancel_appointment_by_token(text, text),
                           public.reschedule_appointment_by_token(text, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.get_appointment_by_token(text),
                          public.cancel_appointment_by_token(text, text),
                          public.reschedule_appointment_by_token(text, timestamptz, uuid)
  to service_role;

------------------------------------------------------------------------------
-- Staff: walk-in / phone booking (dashboard). Working hours are NOT enforced (staff may
-- squeeze someone in), but the exclusion constraint still makes overlaps impossible.
------------------------------------------------------------------------------
create or replace function public.staff_create_appointment(
  p_location_id    uuid,
  p_service_id     uuid,
  p_dentist_id     uuid,
  p_starts_at      timestamptz,
  p_full_name      text,
  p_phone          text,
  p_source         public.appointment_source default 'phone',
  p_status         public.appointment_status default 'confirmed',
  p_ends_at        timestamptz default null,
  p_internal_notes text default null
)
returns table (appointment_id uuid, manage_token text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_patient_id uuid;
  v_token      text;
  v_ends       timestamptz;
  v_id         uuid;
begin
  if not public.can_access_location(p_location_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_source not in ('phone', 'walk_in', 'admin') then
    raise exception using errcode = 'P0001', message = 'INVALID_SOURCE';
  end if;
  if p_status not in ('pending', 'confirmed') then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS';
  end if;
  if not exists (select 1 from public.dentists d where d.id = p_dentist_id and d.is_active) then
    raise exception using errcode = 'P0001', message = 'INVALID_DENTIST';
  end if;

  select coalesce(p_ends_at, p_starts_at + make_interval(mins => s.duration_minutes))
    into v_ends
  from public.services s where s.id = p_service_id and s.is_active;
  if v_ends is null then
    raise exception using errcode = 'P0001', message = 'INVALID_SERVICE';
  end if;
  if v_ends <= p_starts_at then
    raise exception using errcode = 'P0001', message = 'INVALID_TIME';
  end if;

  v_patient_id := public._upsert_patient(p_phone, p_full_name);
  v_token := public._new_manage_token();

  begin
    insert into public.appointments (
      location_id, dentist_id, service_id, patient_id, starts_at, ends_at, status, source,
      internal_notes, confirmed_at, created_by)
    values (
      p_location_id, p_dentist_id, p_service_id, v_patient_id, p_starts_at, v_ends, p_status, p_source,
      nullif(btrim(coalesce(p_internal_notes, '')), ''),
      case when p_status = 'confirmed' then now() end, auth.uid())
    returning id into v_id;
    insert into public.appointment_secrets (appointment_id, manage_token) values (v_id, v_token);
  exception when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE';
  end;

  appointment_id := v_id;
  manage_token   := v_token;
  return next;
end;
$$;

revoke execute on function public.staff_create_appointment(uuid, uuid, uuid, timestamptz, text, text,
  public.appointment_source, public.appointment_status, timestamptz, text) from public, anon;
grant execute on function public.staff_create_appointment(uuid, uuid, uuid, timestamptz, text, text,
  public.appointment_source, public.appointment_status, timestamptz, text) to authenticated, service_role;
