-- 0012 — Remove appointment reminders (the clinic decided not to send them).
--
--   • Stops the 'sms-reminders' pg_cron job and drops enqueue_due_reminders().
--   • Deletes the reminder_24h / reminder_2h templates, so nothing can render them.
--   • Drops settings.reminders_enabled (its only reader was enqueue_due_reminders).
--   • Kept on purpose: the 'reminder_24h' / 'reminder_2h' enum values (old sms_log rows use them;
--     Postgres can't drop enum values) and appointments.reminder_*_sent_at (still reset by the
--     move trigger from 0005; harmless). Reminders already queued but unsent are skipped below.

do $$
begin
  -- Dynamic SQL: the cron schema only exists where pg_cron is installed (not in local PGlite tests).
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $q$select cron.unschedule(jobid) from cron.job where jobname = 'sms-reminders'$q$;
  end if;
end $$;

drop function if exists public.enqueue_due_reminders();

update public.sms_log
   set status = 'skipped', error = 'Reminders were turned off'
 where type in ('reminder_24h', 'reminder_2h') and status = 'queued';

delete from public.sms_templates where key in ('reminder_24h', 'reminder_2h');

alter table public.settings drop column if exists reminders_enabled;
