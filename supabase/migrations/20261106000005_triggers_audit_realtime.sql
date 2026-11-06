-- 0005 — Appointment workflow trigger, audit log, realtime

------------------------------------------------------------------------------
-- Keep appointment bookkeeping consistent no matter who updates the row
------------------------------------------------------------------------------
create or replace function public.appointments_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_dur int;
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    if new.status = 'confirmed' then new.confirmed_at := coalesce(new.confirmed_at, now()); end if;
    return new;
  end if;

  -- Service changed without an explicit new end: use the new service's duration.
  if new.service_id is distinct from old.service_id and new.ends_at = old.ends_at then
    select s.duration_minutes into v_dur from public.services s where s.id = new.service_id;
    new.ends_at := new.starts_at + make_interval(mins => v_dur);
  -- Moved without an explicit new end: keep the same length.
  elsif new.starts_at <> old.starts_at and new.ends_at = old.ends_at then
    new.ends_at := new.starts_at + (old.ends_at - old.starts_at);
  end if;

  -- New time => reminders must go out again.
  if new.starts_at <> old.starts_at then
    new.reminder_24h_sent_at := null;
    new.reminder_2h_sent_at  := null;
  end if;

  if new.status is distinct from old.status then
    case new.status
      when 'confirmed' then
        new.confirmed_at := coalesce(new.confirmed_at, now());
        new.cancelled_at := null; new.cancelled_by := null;
      when 'cancelled' then
        new.cancelled_at := now();
        new.cancelled_by := coalesce(new.cancelled_by,
                                     case when auth.uid() is not null then 'staff' else 'system' end);
      when 'completed' then
        new.completed_at := now();
      when 'pending' then
        new.cancelled_at := null; new.cancelled_by := null;
      else null;
    end case;
  end if;

  return new;
end;
$$;

create trigger appointments_before_write
  before insert or update on public.appointments
  for each row execute function public.appointments_before_write();

------------------------------------------------------------------------------
-- Generic audit trigger
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
      and n.key not in ('updated_at', 'during', 'minute_range');
    if v_changes is null then return null; end if;   -- nothing meaningful changed
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

create trigger audit_appointments  after insert or update or delete on public.appointments
  for each row execute function public.audit_row_change();
create trigger audit_profiles      after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();
create trigger audit_settings      after update on public.settings
  for each row execute function public.audit_row_change();
create trigger audit_sms_templates after insert or update on public.sms_templates
  for each row execute function public.audit_row_change();

revoke execute on function public.appointments_before_write(), public.audit_row_change()
  from public, anon, authenticated;

------------------------------------------------------------------------------
-- Realtime (postgres_changes respects RLS, so staff only receive their location's rows)
------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.appointments, public.sms_log;
  end if;
end $$;
