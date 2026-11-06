-- 0003 — Role helpers, grants and Row Level Security
--
-- Access model
--   anon (public site)   : active locations / services / dentists / working hours, plus the slot RPCs.
--                          Nothing patient-related. Bookings only via the create-booking Edge Function.
--   staff (authenticated): data for their own location_id.
--   owner (authenticated): everything.
--   service_role         : Edge Functions; bypasses RLS.

------------------------------------------------------------------------------
-- Helpers (security definer so policies don't recurse through profiles RLS)
------------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_active and p.role = 'owner');
$$;

create or replace function public.my_location_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.location_id from public.profiles p where p.id = auth.uid() and p.is_active;
$$;

create or replace function public.can_access_location(p_location_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_active
                   and (p.role = 'owner' or p.location_id = p_location_id));
$$;

-- Staff can see a patient if the patient has (or had) an appointment at their location.
create or replace function public.can_access_patient(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_owner()
      or exists (select 1 from public.appointments a
                 where a.patient_id = p_patient_id
                   and a.location_id = public.my_location_id());
$$;

-- anon needs EXECUTE too: public read policies call is_staff(). For anon they simply return false/null.
revoke execute on function public.is_staff(), public.is_owner(), public.my_location_id(),
  public.can_access_location(uuid), public.can_access_patient(uuid) from public;
grant execute on function public.is_staff(), public.is_owner(), public.my_location_id(),
  public.can_access_location(uuid), public.can_access_patient(uuid) to anon, authenticated, service_role;

------------------------------------------------------------------------------
-- Table privileges (defence in depth on top of RLS)
------------------------------------------------------------------------------
revoke all on public.patients, public.appointments, public.time_off, public.profiles,
              public.settings, public.sms_templates, public.sms_log, public.rate_limits,
              public.audit_log, public.appointment_secrets
  from anon;
revoke insert, update, delete, truncate on public.locations, public.services, public.dentists,
              public.dentist_services, public.working_hours
  from anon;

-- Nobody except service_role touches these directly.
revoke all on public.rate_limits, public.appointment_secrets from authenticated;
revoke insert, update, delete, truncate on public.audit_log, public.sms_log from authenticated;

-- Appointments: rows are created only through RPCs; staff may update only workflow columns.
revoke insert, update, truncate on public.appointments from authenticated;
grant update (location_id, dentist_id, service_id, starts_at, ends_at, status,
              internal_notes, cancel_reason)
  on public.appointments to authenticated;

-- Patients: created through RPCs; staff may edit contact details and notes.
revoke insert, update, truncate on public.patients from authenticated;
grant update (full_name, email, notes) on public.patients to authenticated;

------------------------------------------------------------------------------
-- Enable RLS everywhere
------------------------------------------------------------------------------
alter table public.locations        enable row level security;
alter table public.services         enable row level security;
alter table public.dentists         enable row level security;
alter table public.dentist_services enable row level security;
alter table public.working_hours    enable row level security;
alter table public.time_off         enable row level security;
alter table public.patients         enable row level security;
alter table public.appointments     enable row level security;
alter table public.profiles         enable row level security;
alter table public.settings         enable row level security;
alter table public.sms_templates    enable row level security;
alter table public.sms_log          enable row level security;
alter table public.rate_limits      enable row level security;  -- no policies: service_role only
alter table public.appointment_secrets enable row level security; -- no policies: service_role only
alter table public.audit_log        enable row level security;

------------------------------------------------------------------------------
-- Catalog: locations / services / dentists / dentist_services
------------------------------------------------------------------------------
create policy "locations: read active or staff" on public.locations
  for select to anon, authenticated
  using (is_active or (select public.is_staff()));
create policy "locations: owner insert" on public.locations
  for insert to authenticated with check ((select public.is_owner()));
create policy "locations: owner update" on public.locations
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "locations: owner delete" on public.locations
  for delete to authenticated using ((select public.is_owner()));

create policy "services: read active or staff" on public.services
  for select to anon, authenticated
  using (is_active or (select public.is_staff()));
create policy "services: owner insert" on public.services
  for insert to authenticated with check ((select public.is_owner()));
create policy "services: owner update" on public.services
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "services: owner delete" on public.services
  for delete to authenticated using ((select public.is_owner()));

create policy "dentists: read active or staff" on public.dentists
  for select to anon, authenticated
  using (is_active or (select public.is_staff()));
create policy "dentists: owner insert" on public.dentists
  for insert to authenticated with check ((select public.is_owner()));
create policy "dentists: owner update" on public.dentists
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "dentists: owner delete" on public.dentists
  for delete to authenticated using ((select public.is_owner()));

create policy "dentist_services: read active or staff" on public.dentist_services
  for select to anon, authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.dentists d join public.services s on s.id = dentist_services.service_id
               where d.id = dentist_services.dentist_id and d.is_active and s.is_active)
  );
create policy "dentist_services: owner insert" on public.dentist_services
  for insert to authenticated with check ((select public.is_owner()));
create policy "dentist_services: owner delete" on public.dentist_services
  for delete to authenticated using ((select public.is_owner()));

------------------------------------------------------------------------------
-- working_hours: public read (it's availability); staff manage their location, owner all
------------------------------------------------------------------------------
create policy "working_hours: read active or staff" on public.working_hours
  for select to anon, authenticated
  using (
    (select public.is_staff())
    or exists (select 1 from public.dentists d join public.locations l on l.id = working_hours.location_id
               where d.id = working_hours.dentist_id and d.is_active and l.is_active)
  );
create policy "working_hours: staff insert own location" on public.working_hours
  for insert to authenticated with check ((select public.can_access_location(location_id)));
create policy "working_hours: staff update own location" on public.working_hours
  for update to authenticated
  using ((select public.can_access_location(location_id)))
  with check ((select public.can_access_location(location_id)));
create policy "working_hours: staff delete own location" on public.working_hours
  for delete to authenticated using ((select public.can_access_location(location_id)));

------------------------------------------------------------------------------
-- time_off: staff read all (scheduling context), write own location; owner all
-- (location_id null = "dentist off everywhere" → owner only)
------------------------------------------------------------------------------
create policy "time_off: staff read" on public.time_off
  for select to authenticated using ((select public.is_staff()));
create policy "time_off: staff insert" on public.time_off
  for insert to authenticated
  with check ((select public.is_owner()) or (location_id is not null and location_id = (select public.my_location_id())));
create policy "time_off: staff update" on public.time_off
  for update to authenticated
  using ((select public.is_owner()) or (location_id is not null and location_id = (select public.my_location_id())))
  with check ((select public.is_owner()) or (location_id is not null and location_id = (select public.my_location_id())));
create policy "time_off: staff delete" on public.time_off
  for delete to authenticated
  using ((select public.is_owner()) or (location_id is not null and location_id = (select public.my_location_id())));

------------------------------------------------------------------------------
-- patients
------------------------------------------------------------------------------
create policy "patients: staff read own location" on public.patients
  for select to authenticated using ((select public.can_access_patient(id)));
create policy "patients: staff update own location" on public.patients
  for update to authenticated
  using ((select public.can_access_patient(id)))
  with check ((select public.can_access_patient(id)));
create policy "patients: owner delete" on public.patients
  for delete to authenticated using ((select public.is_owner()));

------------------------------------------------------------------------------
-- appointments
------------------------------------------------------------------------------
create policy "appointments: staff read own location" on public.appointments
  for select to authenticated using ((select public.can_access_location(location_id)));
create policy "appointments: staff update own location" on public.appointments
  for update to authenticated
  using ((select public.can_access_location(location_id)))
  with check ((select public.can_access_location(location_id)));
create policy "appointments: owner delete" on public.appointments
  for delete to authenticated using ((select public.is_owner()));

------------------------------------------------------------------------------
-- profiles: everyone reads their own; owner manages all
------------------------------------------------------------------------------
create policy "profiles: read self or owner" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_owner()));
create policy "profiles: owner insert" on public.profiles
  for insert to authenticated with check ((select public.is_owner()));
create policy "profiles: owner update" on public.profiles
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "profiles: owner delete" on public.profiles
  for delete to authenticated using ((select public.is_owner()) and id <> (select auth.uid()));

------------------------------------------------------------------------------
-- settings / sms_templates: staff read, owner write
------------------------------------------------------------------------------
create policy "settings: staff read" on public.settings
  for select to authenticated using ((select public.is_staff()));
create policy "settings: owner update" on public.settings
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "sms_templates: staff read" on public.sms_templates
  for select to authenticated using ((select public.is_staff()));
create policy "sms_templates: owner update" on public.sms_templates
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "sms_templates: owner insert" on public.sms_templates
  for insert to authenticated with check ((select public.is_owner()));

------------------------------------------------------------------------------
-- sms_log: staff read own location (owner all, incl. location-less alerts). Writes: service_role.
------------------------------------------------------------------------------
create policy "sms_log: staff read own location" on public.sms_log
  for select to authenticated
  using ((select public.is_owner())
         or (location_id is not null and location_id = (select public.my_location_id())));

------------------------------------------------------------------------------
-- audit_log: owner read. Writes come from security-definer triggers.
------------------------------------------------------------------------------
create policy "audit_log: owner read" on public.audit_log
  for select to authenticated using ((select public.is_owner()));
