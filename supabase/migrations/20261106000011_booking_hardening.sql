-- 0011 — Booking hardening
--
--   • An online booking can no longer RENAME an existing patient: booking with someone else's phone
--     number used to overwrite that patient's saved name. The saved name now stays; staff edit names
--     on the patient page.
--   • Names may not contain links, e-mail addresses or digits. The first name is put into the SMS
--     ("Hi {patient_name}"), so without this rule the booking form could be used to make the clinic
--     text a link to any phone number. Amharic and Latin names are unaffected.

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
  if char_length(v_name) not between 2 and 100
     or v_name ~* '(https?:|www\.|[a-z0-9-]\.[a-z]{2,}|[@/\\:<>]|[0-9])' then
    raise exception using errcode = 'P0001', message = 'INVALID_NAME';
  end if;

  select p.id into v_id from public.patients p where p.phone = p_phone;
  if v_id is null then
    insert into public.patients (phone, full_name)
    values (p_phone, v_name)
    on conflict (phone) do nothing
    returning id into v_id;
    if v_id is null then -- a parallel booking inserted the same phone first
      select p.id into v_id from public.patients p where p.phone = p_phone;
    end if;
  end if;
  return v_id;
end;
$$;

revoke execute on function public._upsert_patient(text, text) from public, anon, authenticated;
