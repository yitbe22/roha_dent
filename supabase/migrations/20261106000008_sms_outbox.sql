-- 0008 — SMS outbox, reminders, worker trigger
--
-- Flow: appointment change ──(deferred trigger, at COMMIT)──▶ sms_log rows (status 'queued', body rendered)
--       ──(pg_net kick + pg_cron every minute)──▶ send-sms Edge Function ──▶ SMS Ethiopia
-- Because SMS rows are created by the database itself, every path (online booking, patient link,
-- dashboard edits, reminders) sends the right message, and every attempt is visible in sms_log.

alter table public.sms_log add column if not exists next_attempt_at timestamptz;
create index if not exists sms_log_queue_idx on public.sms_log (next_attempt_at) where status = 'queued';
create index if not exists sms_log_poll_idx on public.sms_log (last_checked_at) where status in ('accepted', 'sent');

-- Reminder flags are reset on reschedule, so a second reminder of the same type is legitimate.
drop index if exists public.sms_log_one_reminder_idx;

------------------------------------------------------------------------------
-- Template rendering:  'Hi {patient_name}' + {"patient_name":"Abebe"} → 'Hi Abebe'
------------------------------------------------------------------------------
create or replace function public.render_sms_template(p_body text, p_vars jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_out text := p_body;
  r record;
begin
  for r in select key, value from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) loop
    v_out := replace(v_out, '{' || r.key || '}', coalesce(r.value, ''));
  end loop;
  return v_out;
end;
$$;

------------------------------------------------------------------------------
-- Enqueue one SMS type for one appointment (internal)
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
  v          record;
  v_template   text;
  v_recipients text[];
  v_body       text;
  v_status     public.sms_status;
  v_error      text;
  v_to         text;
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

  v_body := public.render_sms_template(coalesce(v_template, ''), jsonb_build_object(
    'patient_name',   split_part(v.full_name, ' ', 1),
    'patient_phone',  v.patient_phone,
    'date',           to_char(v.starts_at at time zone public.clinic_tz(), 'Dy FMDD Mon'),
    'time',           to_char(v.starts_at at time zone public.clinic_tz(), 'HH24:MI'),
    'service',        v.service_name,
    'location',       v.city,
    'location_phone', v.location_phone,
    'dentist',        v.dentist_name,
    'status',         v.status,
    'manage_link',    case when v.manage_token is null then v_cfg.public_site_url
                           else rtrim(v_cfg.public_site_url, '/') || '/booking/' || v.manage_token end
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

------------------------------------------------------------------------------
-- Appointment events → SMS. Deferred to COMMIT so appointment_secrets exists and
-- rolled-back attempts (e.g. a lost double-booking race) never send anything.
------------------------------------------------------------------------------
create or replace function public.appointments_sms_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform public._enqueue_appointment_sms(new.id, 'booking_received');
    elsif new.status = 'confirmed' then
      perform public._enqueue_appointment_sms(new.id, 'booking_confirmed');
    end if;
    if new.source = 'online' then
      perform public._enqueue_appointment_sms(new.id, 'clinic_new_booking');
    end if;
    return null;
  end if;

  -- UPDATE
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    perform public._enqueue_appointment_sms(new.id, 'booking_cancelled');
  elsif new.starts_at <> old.starts_at and new.status in ('pending', 'confirmed') then
    perform public._enqueue_appointment_sms(new.id, 'booking_rescheduled');
  elsif new.status = 'confirmed' and old.status = 'pending' then
    perform public._enqueue_appointment_sms(new.id, 'booking_confirmed');
  end if;
  return null;
end;
$$;

create constraint trigger appointments_sms_events
  after insert or update on public.appointments
  deferrable initially deferred
  for each row execute function public.appointments_sms_events();

------------------------------------------------------------------------------
-- Reminders (pg_cron every 5 minutes). Idempotent: the *_sent_at claim and the
-- enqueue happen in one transaction; rows already claimed never match again.
--   24h: confirmed, starts within 24h (and > 3h away), booked at least 24h ahead
--   2h : confirmed, starts within 2h (and in the future), booked at least 3h ahead
------------------------------------------------------------------------------
create or replace function public.enqueue_due_reminders()
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cfg   public.settings;
  v_id    uuid;
  v_count int := 0;
begin
  select * into v_cfg from public.settings s where s.id;
  if not v_cfg.reminders_enabled then return 0; end if;

  for v_id in
    update public.appointments a set reminder_24h_sent_at = now()
    where a.id in (
      select x.id from public.appointments x
      where x.status = 'confirmed' and x.reminder_24h_sent_at is null
        and x.starts_at <= now() + interval '24 hours'
        and x.starts_at >  now() + interval '3 hours'
        and x.created_at <= x.starts_at - interval '24 hours'
      for update skip locked)
    returning a.id
  loop
    v_count := v_count + public._enqueue_appointment_sms(v_id, 'reminder_24h');
  end loop;

  for v_id in
    update public.appointments a set reminder_2h_sent_at = now()
    where a.id in (
      select x.id from public.appointments x
      where x.status = 'confirmed' and x.reminder_2h_sent_at is null
        and x.starts_at <= now() + interval '2 hours'
        and x.starts_at >  now()
        and x.created_at <= x.starts_at - interval '3 hours'
      for update skip locked)
    returning a.id
  loop
    v_count := v_count + public._enqueue_appointment_sms(v_id, 'reminder_2h');
  end loop;

  return v_count;
end;
$$;

------------------------------------------------------------------------------
-- Worker queue claim (send-sms Edge Function, service_role).
-- Also rescues rows stuck in 'sending' (worker crashed mid-batch).
------------------------------------------------------------------------------
create or replace function public.claim_sms_batch(p_limit int default 20)
returns setof public.sms_log
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.sms_log
     set status = 'queued', error = coalesce(error, 'worker timeout; retrying')
   where status = 'sending' and updated_at < now() - interval '5 minutes';

  return query
    update public.sms_log l
       set status = 'sending', attempts = l.attempts + 1
     where l.id in (
       select q.id from public.sms_log q
       where q.status = 'queued' and (q.next_attempt_at is null or q.next_attempt_at <= now())
       order by q.created_at
       limit greatest(1, least(p_limit, 100))
       for update skip locked)
    returning l.*;
end;
$$;

------------------------------------------------------------------------------
-- Dashboard: resend an SMS (staff for own location, owner all)
------------------------------------------------------------------------------
create or replace function public.resend_sms(p_sms_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v   public.sms_log;
  v_id uuid;
begin
  select * into v from public.sms_log where id = p_sms_id;
  if not found or not (public.is_owner() or (v.location_id is not null and v.location_id = public.my_location_id())) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  insert into public.sms_log (appointment_id, location_id, type, to_phone, body, status, resend_of, created_by)
  values (v.appointment_id, v.location_id, v.type, v.to_phone, v.body, 'queued', v.id, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

------------------------------------------------------------------------------
-- Kick the send-sms worker via pg_net right after new queued rows are committed.
-- Needs two Vault secrets: 'project_url' and 'sms_worker_secret' (see README).
-- No-ops quietly where pg_net/Vault aren't available (PGlite tests); pg_cron is the safety net.
------------------------------------------------------------------------------
create or replace function public.kick_sms_worker()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then
    return;
  end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'project_url'$q$ into v_url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'sms_worker_secret'$q$ into v_secret;
  if v_url is null or v_secret is null then
    raise warning 'kick_sms_worker: Vault secrets project_url / sms_worker_secret are missing';
    return;
  end if;
  execute $q$select net.http_post(url := $1, body := '{}'::jsonb,
                                   headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', $2),
                                   timeout_milliseconds := 20000)$q$
    using rtrim(v_url, '/') || '/functions/v1/send-sms', v_secret;
end;
$$;

-- pg_cron tick: only call the worker when something is queued or a delivery status is due for a check.
create or replace function public.sms_worker_tick()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.sms_log
             where (status = 'queued' and (next_attempt_at is null or next_attempt_at <= now()))
                or (status = 'sending' and updated_at < now() - interval '5 minutes')
                or (status in ('accepted', 'sent') and provider_message_id is not null
                    and created_at > now() - interval '24 hours'
                    and (last_checked_at is null or last_checked_at < now() - interval '2 minutes'))) then
    perform public.kick_sms_worker();
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.sms_log_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from inserted where status = 'queued') then
    perform public.kick_sms_worker();
  end if;
  return null;
end;
$$;

create trigger sms_log_kick_worker
  after insert on public.sms_log
  referencing new table as inserted
  for each statement execute function public.sms_log_after_insert();

------------------------------------------------------------------------------
-- Audit: ignore pure reminder bookkeeping updates
------------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new     jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old     jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row     jsonb := coalesce(v_new, v_old);
  v_changes jsonb;
  v_action  text  := lower(tg_op);
  v_actor   text  := coalesce(nullif(current_setting('app.actor_type', true), ''),
                              case when auth.uid() is not null then 'staff' else 'system' end);
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
      into v_changes
    from jsonb_each(v_new) n
    join jsonb_each(v_old) o using (key)
    where n.value is distinct from o.value
      and n.key not in ('updated_at', 'during', 'minute_range', 'reminder_24h_sent_at', 'reminder_2h_sent_at');
    if v_changes is null then return null; end if;
    if v_changes ? 'status' then
      v_action := 'status:' || (v_new ->> 'status');
    end if;
  elsif tg_op = 'INSERT' then
    v_changes := v_new - 'during' - 'minute_range';
  else
    v_changes := v_old - 'during' - 'minute_range';
  end if;

  insert into public.audit_log (actor_id, actor_type, action, entity, entity_id, location_id, changes)
  values (auth.uid(), v_actor, v_action, tg_table_name,
          coalesce(v_row ->> 'id', v_row ->> 'key'),
          nullif(v_row ->> 'location_id', '')::uuid,
          v_changes);
  return null;
end;
$$;

------------------------------------------------------------------------------
-- Privileges
------------------------------------------------------------------------------
revoke execute on function public._enqueue_appointment_sms(uuid, public.sms_type), public.appointments_sms_events(),
  public.enqueue_due_reminders(), public.claim_sms_batch(int), public.kick_sms_worker(), public.sms_worker_tick(), public.sms_log_after_insert()
  from public, anon, authenticated;
grant execute on function public.enqueue_due_reminders(), public.claim_sms_batch(int), public.kick_sms_worker()
  to service_role;
revoke execute on function public.resend_sms(uuid) from public, anon;
grant execute on function public.resend_sms(uuid) to authenticated, service_role;
grant execute on function public.render_sms_template(text, jsonb) to authenticated, service_role;

------------------------------------------------------------------------------
-- Schedules (hosted Supabase with pg_cron enabled). cron.schedule upserts by job name.
------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('sms-reminders',     '*/5 * * * *', 'select public.enqueue_due_reminders()');
    perform cron.schedule('sms-worker',        '* * * * *',   'select public.sms_worker_tick()');
    perform cron.schedule('purge-rate-limits', '17 3 * * *',  'select public.purge_rate_limits()');
  else
    raise notice 'pg_cron not installed: skipping schedules (enable it in Dashboard → Database → Extensions, then re-run this block)';
  end if;
end $$;
