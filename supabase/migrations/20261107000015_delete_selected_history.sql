-- 0015 — Delete *selected* history rows (dashboard: tick rows → "Delete selected").
--
-- admin_delete_history(p_what, p_ids) follows the same rules as admin_clear_history (0014),
-- but only for the given ids:
--   'sms'       those text messages, except ones still waiting to be (or being) sent
--   'patients'  those patients and all of their appointments
--   'activity'  those change-history entries (audit_log ids)
-- Owner only. One summary line goes to the change history.

create or replace function public.admin_delete_history(p_what text, p_ids text[])
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
    raise exception 'Only the clinic owner can delete history' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    return jsonb_build_object('deleted', 0, 'appointments_deleted', 0);
  end if;
  if cardinality(p_ids) > 1000 then
    raise exception 'Select at most 1000 rows at a time' using errcode = '22023';
  end if;

  perform set_config('app.skip_audit', 'on', true);   -- this transaction only

  if p_what = 'sms' then
    delete from public.sms_log
     where id = any (p_ids::uuid[]) and status not in ('queued', 'sending');
    get diagnostics v_count = row_count;
  elsif p_what = 'patients' then
    delete from public.appointments where patient_id = any (p_ids::uuid[]);
    get diagnostics v_appointments = row_count;
    delete from public.patients where id = any (p_ids::uuid[]);
    get diagnostics v_count = row_count;
  elsif p_what = 'activity' then
    delete from public.audit_log where id = any (p_ids::bigint[]);
    get diagnostics v_count = row_count;
  else
    raise exception 'Unknown history: %', p_what using errcode = '22023';
  end if;

  perform set_config('app.skip_audit', 'off', true);
  insert into public.audit_log (actor_id, actor_type, action, entity, changes)
  values (auth.uid(), 'staff', 'delete_selected', p_what,
          jsonb_build_object('deleted', v_count, 'appointments_deleted', v_appointments));

  return jsonb_build_object('deleted', v_count, 'appointments_deleted', v_appointments);
end;
$$;

revoke all on function public.admin_delete_history(text, text[]) from public, anon;
grant execute on function public.admin_delete_history(text, text[]) to authenticated;
