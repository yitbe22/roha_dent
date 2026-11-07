-- 0014 — "Clear history" for the clinic owner (dashboard → Settings → Clear history).
--
-- admin_clear_history(p_what) permanently deletes one kind of history:
--   'sms'       every text message in the log, except ones still waiting to be (or being) sent
--   'patients'  every patient and all of their appointments (and the appointments' manage links)
--   'activity'  the change history (audit_log)
-- Owner only. One summary line is written to the change history instead of one row per deleted
-- record, so clearing patients doesn't refill the history with their details.

-- The audit trigger can be paused for the current transaction with app.skip_audit = 'on'.
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
  if current_setting('app.skip_audit', true) = 'on' then return null; end if;

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

create or replace function public.admin_clear_history(p_what text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count        int := 0;
  v_appointments int := 0;
begin
  if not public.is_owner() then
    raise exception 'Only the clinic owner can clear history' using errcode = '42501';
  end if;

  perform set_config('app.skip_audit', 'on', true);   -- this transaction only

  if p_what = 'sms' then
    delete from public.sms_log where status not in ('queued', 'sending');
    get diagnostics v_count = row_count;
  elsif p_what = 'patients' then
    -- sms_log.appointment_id is "on delete set null" and appointment_secrets cascades.
    delete from public.appointments where true;
    get diagnostics v_appointments = row_count;
    delete from public.patients where true;
    get diagnostics v_count = row_count;
  elsif p_what = 'activity' then
    delete from public.audit_log where true;
    get diagnostics v_count = row_count;
  else
    raise exception 'Unknown history: %', p_what using errcode = '22023';
  end if;

  perform set_config('app.skip_audit', 'off', true);
  insert into public.audit_log (actor_id, actor_type, action, entity, changes)
  values (auth.uid(), 'staff', 'clear_history', p_what,
          jsonb_build_object('deleted', v_count, 'appointments_deleted', v_appointments));

  return jsonb_build_object('deleted', v_count, 'appointments_deleted', v_appointments);
end;
$$;

revoke all on function public.admin_clear_history(text) from public, anon;
grant execute on function public.admin_clear_history(text) to authenticated;
