-- 0001 — Extensions, enums and generic helpers
-- Supabase installs extensions into the `extensions` schema.

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto  with schema extensions;

create type public.appointment_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.appointment_source as enum ('online', 'phone', 'walk_in', 'admin');
create type public.user_role          as enum ('owner', 'staff');

create type public.sms_type as enum (
  'booking_received',
  'booking_confirmed',
  'booking_cancelled',
  'booking_rescheduled',
  'reminder_24h',
  'reminder_2h',
  'clinic_new_booking',
  'manual'
);

-- Lifecycle of one SMS row in sms_log.
--   queued -> sending -> accepted -> sent -> delivered
--                     \-> failed / rejected / undelivered / expired
--   dry_run : SMS_DRY_RUN=true, nothing was sent
--   skipped : intentionally not sent (sms disabled, no valid number, ...)
create type public.sms_status as enum (
  'queued', 'sending', 'dry_run', 'accepted', 'sent', 'delivered',
  'undelivered', 'failed', 'rejected', 'expired', 'skipped'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Clinic timezone (Ethiopia has no DST). All timestamps are stored as timestamptz (UTC);
-- local wall-clock conversions use this constant.
create or replace function public.clinic_tz()
returns text
language sql
immutable
set search_path = ''
as $$ select 'Africa/Addis_Ababa'::text $$;
