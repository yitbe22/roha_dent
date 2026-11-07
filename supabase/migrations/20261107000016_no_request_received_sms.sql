-- 0016 — No text when a patient books. Patients only get an SMS once staff act on the booking:
--
--   confirmed  → "booking_confirmed" (also for bookings created as confirmed, e.g. by staff)
--   cancelled  → "booking_cancelled"
--   new time   → "booking_rescheduled", only for an already-confirmed booking (a pending booking's
--                time goes out in its confirmation)
--
-- The clinic's own "new online booking" alert (clinic_new_booking, to the clinic's phones) is kept.
-- Also: deletes the booking_received template (so it disappears from the dashboard) and skips any
-- "request received" texts still waiting in the outbox. The enum value stays (old log rows use it;
-- Postgres can't drop enum values).

create or replace function public.appointments_sms_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then
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
  elsif new.status = 'confirmed' and old.status = 'pending' then
    perform public._enqueue_appointment_sms(new.id, 'booking_confirmed');   -- carries the (new) time
  elsif new.starts_at <> old.starts_at and new.status = 'confirmed' and old.status = 'confirmed' then
    perform public._enqueue_appointment_sms(new.id, 'booking_rescheduled');
  end if;
  return null;
end;
$$;

revoke execute on function public.appointments_sms_events() from public, anon, authenticated;

update public.sms_log
   set status = 'skipped', error = 'Booking-request texts were turned off'
 where type = 'booking_received' and status = 'queued';

delete from public.sms_templates where key = 'booking_received';
