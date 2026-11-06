-- 0002 — Core tables

-- Ethiopian mobile numbers in E.164. SMS Ethiopia only accepts 2519XXXXXXXX (Ethio Telecom),
-- so for now patients must use an 09 number. Widen this check if Safaricom (07) is added later.
-- Used as:  check (col ~ '^\+2519[0-9]{8}$')

------------------------------------------------------------------------------
-- locations
------------------------------------------------------------------------------
create table public.locations (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name               text not null check (char_length(name) between 2 and 120),
  name_am            text,
  city               text not null,
  address            text,
  address_am         text,
  phone              text not null,                -- public phone shown on the site (display format)
  whatsapp           text,                         -- digits only, e.g. 251946040506
  email              text,
  alert_phone        text check (alert_phone is null or alert_phone ~ '^\+2519[0-9]{8}$'), -- new-booking SMS alerts
  map_url            text,
  latitude           numeric(9,6),
  longitude          numeric(9,6),
  opening_hours_note text,                         -- free text for the site, e.g. "Mon–Sat 8:30–17:30"
  is_active          boolean not null default true,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

------------------------------------------------------------------------------
-- services
------------------------------------------------------------------------------
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text not null check (char_length(name) between 2 and 120),
  name_am          text,
  summary          text,
  summary_am       text,
  description      text,
  description_am   text,
  duration_minutes int not null check (duration_minutes between 5 and 480 and duration_minutes % 5 = 0),
  price_from_etb   numeric(10,2) check (price_from_etb is null or price_from_etb >= 0),
  is_bookable      boolean not null default true,   -- false = shown on site but not bookable online
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

------------------------------------------------------------------------------
-- dentists
------------------------------------------------------------------------------
create table public.dentists (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  full_name              text not null check (char_length(full_name) between 2 and 120),
  full_name_am           text,
  title                  text,                     -- e.g. "Orthodontist"
  title_am               text,
  bio                    text,
  bio_am                 text,
  photo_url              text,
  years_experience       int check (years_experience is null or years_experience between 0 and 70),
  languages              text[] not null default array['English', 'Amharic'],
  accepts_online_booking boolean not null default true,
  is_active              boolean not null default true,
  sort_order             int not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.dentist_services (
  dentist_id uuid not null references public.dentists(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (dentist_id, service_id)
);
create index dentist_services_service_idx on public.dentist_services (service_id);

------------------------------------------------------------------------------
-- working_hours — weekly template, per dentist AND location
-- (a dentist may work at both clinics on different days/hours)
------------------------------------------------------------------------------
create table public.working_hours (
  id           uuid primary key default gen_random_uuid(),
  dentist_id   uuid not null references public.dentists(id) on delete cascade,
  location_id  uuid not null references public.locations(id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6),   -- 0 = Sunday … 6 = Saturday
  start_time   time not null,
  end_time     time not null,
  minute_range int4range generated always as (
                 int4range((extract(epoch from start_time) / 60)::int,
                           (extract(epoch from end_time)   / 60)::int)
               ) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint working_hours_valid check (end_time > start_time),
  -- a dentist can't be scheduled in two places (or twice) at the same time of the week
  constraint working_hours_no_overlap exclude using gist (
    dentist_id with =, weekday with =, minute_range with &&
  )
);
create index working_hours_location_idx on public.working_hours (location_id, weekday);

------------------------------------------------------------------------------
-- time_off — dentist leave, or whole-location closure (dentist_id null)
------------------------------------------------------------------------------
create table public.time_off (
  id          uuid primary key default gen_random_uuid(),
  dentist_id  uuid references public.dentists(id) on delete cascade,   -- null = whole location closed
  location_id uuid references public.locations(id) on delete cascade,  -- null = dentist off everywhere
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  during      tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  reason      text check (char_length(reason) <= 300),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint time_off_valid  check (ends_at > starts_at),
  constraint time_off_target check (dentist_id is not null or location_id is not null)
);
create index time_off_during_idx on public.time_off using gist (during);

------------------------------------------------------------------------------
-- patients — one row per normalized phone number
------------------------------------------------------------------------------
create table public.patients (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique check (phone ~ '^\+2519[0-9]{8}$'),
  full_name  text not null check (char_length(full_name) between 2 and 100),
  email      text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes      text check (char_length(notes) <= 4000),       -- internal, staff only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patients_name_idx on public.patients (lower(full_name));

------------------------------------------------------------------------------
-- appointments
------------------------------------------------------------------------------
create table public.appointments (
  id                   uuid primary key default gen_random_uuid(),
  location_id          uuid not null references public.locations(id),
  dentist_id           uuid not null references public.dentists(id),
  service_id           uuid not null references public.services(id),
  patient_id           uuid not null references public.patients(id),
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  during               tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  status               public.appointment_status not null default 'pending',
  source               public.appointment_source not null default 'online',
  patient_notes        text check (char_length(patient_notes) <= 500),     -- written by the patient
  internal_notes       text check (char_length(internal_notes) <= 4000),   -- staff only
  reschedule_count     int not null default 0,
  confirmed_at         timestamptz,
  cancelled_at         timestamptz,
  cancelled_by         text check (cancelled_by in ('patient', 'staff', 'system')),
  cancel_reason        text check (char_length(cancel_reason) <= 500),
  completed_at         timestamptz,
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at  timestamptz,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint appointments_time_valid check (ends_at > starts_at),
  -- THE double-booking guard: a dentist can never have two active appointments that overlap.
  constraint appointments_no_overlap exclude using gist (
    dentist_id with =, during with &&
  ) where (status in ('pending', 'confirmed'))
);
create index appointments_location_start_idx on public.appointments (location_id, starts_at);
create index appointments_dentist_start_idx  on public.appointments (dentist_id, starts_at);
create index appointments_patient_idx        on public.appointments (patient_id, starts_at desc);
create index appointments_reminders_idx      on public.appointments (starts_at)
  where status in ('pending', 'confirmed');

-- Patient manage-link token (bearer secret). Kept out of `appointments` so staff/dashboard
-- queries never see it; only service_role (Edge Functions building SMS links) can read it.
create table public.appointment_secrets (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  manage_token   text not null unique check (char_length(manage_token) >= 32),
  created_at     timestamptz not null default now()
);

------------------------------------------------------------------------------
-- profiles — staff/owner accounts (1:1 with auth.users)
------------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 2 and 120),
  phone       text check (phone is null or phone ~ '^\+2519[0-9]{8}$'),
  role        public.user_role not null default 'staff',
  location_id uuid references public.locations(id) on delete restrict,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_staff_has_location check (role = 'owner' or location_id is not null)
);

------------------------------------------------------------------------------
-- settings — single row
------------------------------------------------------------------------------
create table public.settings (
  id                              boolean primary key default true check (id),
  auto_confirm                    boolean not null default false,
  slot_interval_minutes           int not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  min_lead_minutes                int not null default 120 check (min_lead_minutes between 0 and 10080),
  max_advance_days                int not null default 60  check (max_advance_days between 1 and 365),
  cancel_cutoff_minutes           int not null default 120 check (cancel_cutoff_minutes between 0 and 10080),
  max_reschedules                 int not null default 3   check (max_reschedules between 0 and 20),
  max_active_bookings_per_patient int not null default 3   check (max_active_bookings_per_patient between 1 and 50),
  sms_enabled                     boolean not null default true,
  reminders_enabled               boolean not null default true,
  owner_alert_phones              text[] not null default '{}',  -- extra numbers alerted for every new booking
  public_site_url                 text not null default 'https://rohadent.com',
  updated_at                      timestamptz not null default now(),
  updated_by                      uuid references auth.users(id) on delete set null
);

------------------------------------------------------------------------------
-- sms_templates — editable text per event (and per locale, for Amharic later)
-- Placeholders: {patient_name} {date} {time} {service} {location} {dentist}
--               {location_phone} {manage_link} {patient_phone} {status}
------------------------------------------------------------------------------
create table public.sms_templates (
  key        public.sms_type not null,
  locale     text not null default 'en' check (locale in ('en', 'am')),
  body       text not null check (char_length(body) between 1 and 1000),
  is_active  boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (key, locale)
);

------------------------------------------------------------------------------
-- sms_log — every SMS attempt, success or failure (never silent)
------------------------------------------------------------------------------
create table public.sms_log (
  id                  uuid primary key default gen_random_uuid(),
  appointment_id      uuid references public.appointments(id) on delete set null,
  location_id         uuid references public.locations(id) on delete set null,  -- denormalized for RLS
  type                public.sms_type not null,
  to_phone            text not null,
  body                text not null,
  segments            int,
  encoding            text check (encoding in ('gsm7', 'ucs2')),
  provider            text not null default 'smsethiopia',
  provider_message_id text,
  status              public.sms_status not null default 'queued',
  error_code          text,
  error               text,
  attempts            int not null default 0,
  resend_of           uuid references public.sms_log(id) on delete set null,
  created_by          uuid references auth.users(id) on delete set null,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  last_checked_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index sms_log_created_idx     on public.sms_log (created_at desc);
create index sms_log_status_idx      on public.sms_log (status, created_at);
create index sms_log_appointment_idx on public.sms_log (appointment_id);
create index sms_log_provider_id_idx on public.sms_log (provider_message_id) where provider_message_id is not null;
-- Belt-and-braces idempotency: at most one original reminder of each kind per appointment.
create unique index sms_log_one_reminder_idx on public.sms_log (appointment_id, type)
  where type in ('reminder_24h', 'reminder_2h') and resend_of is null;

------------------------------------------------------------------------------
-- rate_limits — fixed-window counters used by Edge Functions (service role only)
------------------------------------------------------------------------------
create table public.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (bucket, window_start)
);

------------------------------------------------------------------------------
-- audit_log — who changed what
------------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  actor_type  text not null check (actor_type in ('staff', 'patient', 'system')),
  action      text not null,
  entity      text not null,
  entity_id   text,
  location_id uuid,
  changes     jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_entity_idx  on public.audit_log (entity, entity_id, created_at desc);
create index audit_log_created_idx on public.audit_log (created_at desc);

------------------------------------------------------------------------------
-- updated_at triggers
------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['locations','services','dentists','working_hours','time_off','patients',
                           'appointments','profiles','settings','sms_templates','sms_log']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
