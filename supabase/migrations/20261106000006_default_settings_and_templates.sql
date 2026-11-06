-- 0006 — Required defaults (settings row + English SMS templates).
-- These are application config, not demo data, so they live in a migration.
-- Keep templates short: 160 GSM chars = 1 SMS; Amharic (Unicode) = 70 chars per SMS.

insert into public.settings (id) values (true)
on conflict (id) do nothing;

insert into public.sms_templates (key, locale, body) values
  ('booking_received', 'en',
   'Roha Dental: Hi {patient_name}, we received your request for {service} on {date} at {time}, {location}. We will confirm by SMS. Manage: {manage_link}'),
  ('booking_confirmed', 'en',
   'Roha Dental: {patient_name}, your {service} appointment is confirmed for {date} at {time}, {location}. Change or cancel: {manage_link}'),
  ('booking_cancelled', 'en',
   'Roha Dental: your appointment on {date} at {time} has been cancelled. To rebook call {location_phone} or visit rohadent.com/book'),
  ('booking_rescheduled', 'en',
   'Roha Dental: your appointment is now {date} at {time}, {location}. Details: {manage_link}'),
  ('reminder_24h', 'en',
   'Reminder: {service} at Roha Dental {location} tomorrow {date} at {time}. Can''t come? {manage_link} or call {location_phone}'),
  ('reminder_2h', 'en',
   'Roha Dental: see you today at {time}, {location}. Questions: {location_phone}'),
  ('clinic_new_booking', 'en',
   'New booking ({status}): {patient_name} {patient_phone}, {service}, {date} {time}, {location}, {dentist}')
on conflict (key, locale) do nothing;
