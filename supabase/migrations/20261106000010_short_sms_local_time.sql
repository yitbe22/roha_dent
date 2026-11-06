-- 0010 — Shorter SMS (one part each) + Ethiopian local time/date placeholders.
--
--   • Manage links become  rohadent.com/b/<22-char token>  (was https://rohadent.com/booking/<43 chars>).
--     New tokens are 16 random bytes (128 bits) — still unguessable; lookups are also rate-limited.
--     Existing longer tokens keep working, and /booking/<token> stays a valid URL.
--   • Default templates are rewritten to fit 160 GSM characters even with the longest service name.
--     Templates the owner has already edited are left alone.
--   • New placeholders {local_time} ("3:30 ጠዋት") and {local_date} ("ጥቅምት 27"). They contain Amharic
--     letters, so a message using them is sent as Unicode (70 characters per SMS).

------------------------------------------------------------------------------
-- Shorter manage token
------------------------------------------------------------------------------
create or replace function public._new_manage_token()
returns text
language sql
volatile
set search_path = ''
as $$ select translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_') $$;

alter table public.appointment_secrets drop constraint if exists appointment_secrets_manage_token_check;
alter table public.appointment_secrets add constraint appointment_secrets_manage_token_check
  check (char_length(manage_token) >= 20);

create or replace function public._appointment_id_by_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.appointment_id from public.appointment_secrets s
  where p_token is not null and char_length(p_token) between 20 and 128 and s.manage_token = p_token
$$;

revoke execute on function public._new_manage_token(), public._appointment_id_by_token(text) from public, anon, authenticated;

------------------------------------------------------------------------------
-- Ethiopian local clock and calendar
------------------------------------------------------------------------------
-- 08:30 → '2:30 ጠዋት', 14:15 → '8:15 ከሰዓት', 18:00 → '12:00 ምሽት'
create or replace function public.ethiopian_time(p_at timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select (case when (x.h + 6) % 12 = 0 then 12 else (x.h + 6) % 12 end)::text || ':' || x.mm || ' ' ||
         case when x.h < 6 then 'ሌሊት' when x.h < 12 then 'ጠዋት' when x.h < 18 then 'ከሰዓት' else 'ምሽት' end
  from (select extract(hour from l)::int as h, to_char(l, 'MI') as mm
        from (select p_at at time zone public.clinic_tz() as l) t) x
$$;

-- 2026-11-06 → 'ጥቅምት 27'  (Amete Mihret, via the Julian day number)
create or replace function public.ethiopian_date(p_day date, p_with_year boolean default false)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜ'])[n / 30 + 1]
         || ' ' || (n % 30 + 1)::text
         || case when p_with_year then ', ' || (4 * ((j - 1723856) / 1461) + r / 365 - r / 1460)::text else '' end
  from (select j, r, (r % 365) + 365 * (r / 1460) as n
        from (select j, (j - 1723856) % 1461 as r
              from (select to_char(p_day, 'J')::int as j) a) b) c
$$;

grant execute on function public.ethiopian_time(timestamptz), public.ethiopian_date(date, boolean) to authenticated, service_role;

------------------------------------------------------------------------------
-- Enqueue: short link + local placeholders
------------------------------------------------------------------------------
create or replace function public._enqueue_appointment_sms(p_appointment_id uuid, p_type public.sms_type)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cfg        public.settings;
  v            record;
  v_template   text;
  v_recipients text[];
  v_body       text;
  v_status     public.sms_status;
  v_error      text;
  v_to         text;
  v_host       text;
  v_count      int := 0;
begin
  select * into v_cfg from public.settings s where s.id;

  select a.id, a.status, a.starts_at, a.location_id,
         p.full_name, p.phone as patient_phone,
         l.city, l.phone as location_phone, l.alert_phone,
         d.full_name as dentist_name, s.name as service_name,
         sec.manage_token
    into v
  from public.appointments a
  join public.patients  p on p.id = a.patient_id
  join public.locations l on l.id = a.location_id
  join public.dentists  d on d.id = a.dentist_id
  join public.services  s on s.id = a.service_id
  left join public.appointment_secrets sec on sec.appointment_id = a.id
  where a.id = p_appointment_id;
  if not found then return 0; end if;

  select t.body into v_template
  from public.sms_templates t
  where t.key = p_type and t.locale = 'en' and t.is_active;

  if p_type = 'clinic_new_booking' then
    select coalesce(array_agg(distinct x), '{}') into v_recipients
    from unnest(array_remove(array[v.alert_phone], null) || v_cfg.owner_alert_phones) as x
    where x ~ '^\+2519[0-9]{8}$';
  else
    v_recipients := array[v.patient_phone];
  end if;
  if coalesce(array_length(v_recipients, 1), 0) = 0 then return 0; end if;

  -- Phones turn "rohadent.com/b/…" into a link without https://, which saves 8 characters.
  v_host := regexp_replace(rtrim(v_cfg.public_site_url, '/'), '^https?://(www\.)?', '');

  v_body := public.render_sms_template(coalesce(v_template, ''), jsonb_build_object(
    'patient_name',      split_part(v.full_name, ' ', 1),
    'patient_full_name', v.full_name,
    'patient_phone',     v.patient_phone,
    'date',              to_char(v.starts_at at time zone public.clinic_tz(), 'Dy FMDD Mon'),
    'time',              to_char(v.starts_at at time zone public.clinic_tz(), 'HH24:MI'),
    'local_time',        public.ethiopian_time(v.starts_at),
    'local_date',        public.ethiopian_date((v.starts_at at time zone public.clinic_tz())::date),
    'service',           v.service_name,
    'location',          v.city,
    'location_phone',    v.location_phone,
    'dentist',           v.dentist_name,
    'status',            v.status,
    'manage_link',       case when v.manage_token is null then v_host else v_host || '/b/' || v.manage_token end
  ));

  v_status := case when not v_cfg.sms_enabled or v_template is null then 'skipped' else 'queued' end;
  v_error  := case when not v_cfg.sms_enabled then 'SMS is turned off in settings'
                   when v_template is null then 'Template "' || p_type || '" is disabled' end;

  foreach v_to in array v_recipients loop
    insert into public.sms_log (appointment_id, location_id, type, to_phone, body, status, error)
    values (v.id, v.location_id, p_type, v_to, coalesce(nullif(v_body, ''), '(empty template)'), v_status, v_error);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public._enqueue_appointment_sms(uuid, public.sms_type) from public, anon, authenticated;

------------------------------------------------------------------------------
-- Shorter default texts (only where the owner hasn't changed the original wording)
------------------------------------------------------------------------------
update public.sms_templates t set body = n.body
from (values
  ('booking_received',
   'Roha Dental: Hi {patient_name}, we received your request for {service} on {date} at {time}, {location}. We will confirm by SMS. Manage: {manage_link}',
   'Roha Dental {location}: Hi {patient_name}, we got your request for {date} {time}. We''ll SMS to confirm. Change: {manage_link}'),
  ('booking_confirmed',
   'Roha Dental: {patient_name}, your {service} appointment is confirmed for {date} at {time}, {location}. Change or cancel: {manage_link}',
   'Roha Dental {location}: {patient_name}, confirmed: {service}, {date} {time}. Change/cancel: {manage_link}'),
  ('booking_cancelled',
   'Roha Dental: your appointment on {date} at {time} has been cancelled. To rebook call {location_phone} or visit rohadent.com/book',
   'Roha Dental: your appointment {date} {time} is cancelled. To book again call {location_phone} or rohadent.com/book'),
  ('booking_rescheduled',
   'Roha Dental: your appointment is now {date} at {time}, {location}. Details: {manage_link}',
   'Roha Dental {location}: your appointment is moved to {date} {time}. Details: {manage_link}'),
  ('reminder_24h',
   'Reminder: {service} at Roha Dental {location} tomorrow {date} at {time}. Can''t come? {manage_link} or call {location_phone}',
   'Reminder: Roha Dental {location} tomorrow {date} {time}, {service}. Can''t come? {manage_link}'),
  ('reminder_2h',
   'Roha Dental: see you today at {time}, {location}. Questions: {location_phone}',
   'Roha Dental: see you today at {time}, {location}. Questions: {location_phone}'),
  ('clinic_new_booking',
   'New booking ({status}): {patient_full_name} {patient_phone}, {service}, {date} {time}, {location}, {dentist}',
   'New booking: {patient_full_name} {patient_phone}, {service}, {date} {time}, {location}, {dentist}')
) as n(key, old_body, body)
where t.key = n.key::public.sms_type and t.locale = 'en' and t.body = n.old_body;

------------------------------------------------------------------------------
-- Patient cancel / reschedule by token: same functions as 0004, with the token length
-- check lowered from 32 to 20 so the new 22-character tokens are accepted.
------------------------------------------------------------------------------
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
  if p_token is null or char_length(p_token) not between 20 and 128 then
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
  if p_token is null or char_length(p_token) not between 20 and 128 then
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

------------------------------------------------------------------------------
-- Simple weekly-hours editor: replace one dentist's hours at one clinic in a single transaction
-- (so a clash with the other clinic never leaves the dentist with no hours).
-- SECURITY INVOKER: the normal working_hours RLS applies (staff → own clinic, owner → all).
--   p_hours: [{"weekday":1,"start":"08:30","end":"17:30"}, …]   weekday 0 = Sunday
------------------------------------------------------------------------------
create or replace function public.set_working_hours(p_dentist_id uuid, p_location_id uuid, p_hours jsonb)
returns int
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare v_count int;
begin
  if jsonb_typeof(p_hours) <> 'array' then
    raise exception using errcode = 'P0001', message = 'INVALID_HOURS';
  end if;
  delete from public.working_hours where dentist_id = p_dentist_id and location_id = p_location_id;
  insert into public.working_hours (dentist_id, location_id, weekday, start_time, end_time)
  select p_dentist_id, p_location_id, (h ->> 'weekday')::smallint, (h ->> 'start')::time, (h ->> 'end')::time
  from jsonb_array_elements(p_hours) h;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.set_working_hours(uuid, uuid, jsonb) from public, anon;
grant execute on function public.set_working_hours(uuid, uuid, jsonb) to authenticated, service_role;
