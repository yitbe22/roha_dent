-- RLS / privilege tests. Run: `supabase test db` (pgTAP) or `npm run db:verify` (PGlite).
begin;
select plan(43);

------------------------------------------------------------------------------
-- Fixtures (as postgres)
------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'addis@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'gonder@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'inactive@test.local');

insert into public.profiles (id, full_name, role, location_id, is_active) values
  ('00000000-0000-0000-0000-0000000000a1', 'Owner',        'owner', null, true),
  ('00000000-0000-0000-0000-0000000000a2', 'Addis Staff',  'staff', (select id from public.locations where slug = 'addis-ababa'), true),
  ('00000000-0000-0000-0000-0000000000a3', 'Gonder Staff', 'staff', (select id from public.locations where slug = 'gonder'), true),
  ('00000000-0000-0000-0000-0000000000a4', 'Ex Staff',     'staff', (select id from public.locations where slug = 'addis-ababa'), false);

-- Next Monday at least 3 days out (clinic-local)
create temp table ctx as
select d::date as monday,
       (select id from public.locations where slug = 'addis-ababa') as addis,
       (select id from public.locations where slug = 'gonder')      as gonder,
       (select id from public.services  where slug = 'scaling')     as scaling,
       (select id from public.dentists  where slug = 'dr-selam-bekele')  as selam,
       (select id from public.dentists  where slug = 'dr-dawit-alemu')   as dawit,
       (select id from public.dentists  where slug = 'dr-meron-tadesse') as meron
from generate_series((now() at time zone 'Africa/Addis_Ababa')::date + 3,
                     (now() at time zone 'Africa/Addis_Ababa')::date + 9, interval '1 day') d
where extract(dow from d) = 1
limit 1;

create temp table appt (label text primary key, id uuid, token text);
insert into appt
select 'A1', b.appointment_id, b.manage_token
from ctx, public.book_appointment(ctx.addis, ctx.scaling, ctx.selam,
       (ctx.monday + time '09:00') at time zone 'Africa/Addis_Ababa', 'Abebe Kebede', '+251911000001') b;
insert into appt
select 'G1', b.appointment_id, b.manage_token
from ctx, public.book_appointment(ctx.gonder, ctx.scaling, ctx.meron,
       (ctx.monday + time '09:00') at time zone 'Africa/Addis_Ababa', 'Tigist Haile', '+251911000002') b;

insert into public.sms_log (appointment_id, location_id, type, to_phone, body, status)
select a.id, ap.location_id, 'booking_received', '+251911000001', 'test', 'delivered'
from appt a join public.appointments ap on ap.id = a.id;

-- inactive service must be hidden from the public
insert into public.services (slug, name, duration_minutes, is_active) values ('hidden-service', 'Hidden', 30, false);

grant select on ctx, appt to anon, authenticated;

------------------------------------------------------------------------------
-- anon
------------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from public.locations), 2, 'anon sees active locations');
select is((select count(*)::int from public.services), 7, 'anon sees only active services');
select ok((select count(*) from public.dentists) = 4, 'anon sees active dentists');
select ok((select count(*) from public.working_hours) > 0, 'anon sees working hours');
select throws_ok('select * from public.patients',      '42501', null, 'anon cannot read patients');
select throws_ok('select * from public.appointments',  '42501', null, 'anon cannot read appointments');
select throws_ok('select * from public.sms_log',       '42501', null, 'anon cannot read sms_log');
select throws_ok('select * from public.profiles',      '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.time_off',      '42501', null, 'anon cannot read time_off');
select throws_ok('select * from public.settings',      '42501', null, 'anon cannot read settings');
select throws_ok('select * from public.sms_templates', '42501', null, 'anon cannot read sms_templates');
select throws_ok($$select * from public.book_appointment(null, null, null, now(), 'x', '+251911000009')$$,
                 '42501', null, 'anon cannot call book_appointment directly');
select throws_ok($$select public.get_appointment_by_token('x')$$, '42501', null, 'anon cannot call token RPCs directly');
select throws_ok($$select * from public._available_slots(null, null, current_date)$$, '42501', null, 'anon cannot call internal slot fn');
select throws_ok($$insert into public.locations (slug, name, city, phone) values ('x', 'xx', 'x', '1')$$,
                 '42501', null, 'anon cannot write catalog');
select ok((select count(*) from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday)) > 0,
          'anon can read available slots');

------------------------------------------------------------------------------
-- staff (Addis)
------------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

select is((select count(*)::int from public.appointments), 1, 'Addis staff sees 1 appointment');
select is((select location_id from public.appointments limit 1), (select addis from ctx), '… and it is an Addis one');
select is((select count(*)::int from public.patients), 1, 'Addis staff sees only Addis patients');
select is((select count(*)::int from public.sms_log), 1, 'Addis staff sees only Addis SMS');
select is((select count(*)::int from public.settings), 1, 'staff can read settings');
select is((select count(*)::int from public.audit_log), 0, 'staff cannot read audit log');
select throws_ok('select * from public.rate_limits', '42501', null, 'staff cannot read rate_limits');

select lives_ok($$update public.appointments set status = 'confirmed' where id = (select id from appt where label = 'A1')$$,
                'Addis staff can confirm Addis appointment');
select is((select status::text from public.appointments where id = (select id from appt where label = 'A1')),
          'confirmed', '… status is confirmed');
select is((select confirmed_at is not null from public.appointments where id = (select id from appt where label = 'A1')),
          true, '… confirmed_at set by trigger');

-- silently filtered (0 rows) — verified as postgres below
update public.appointments set internal_notes = 'hacked' where id = (select id from appt where label = 'G1');
update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000a2';
update public.settings set auto_confirm = true;

select throws_ok('select * from public.appointment_secrets', '42501', null, 'staff cannot read manage tokens');
select throws_ok($$update public.appointments set patient_id = gen_random_uuid() where id = (select id from appt where label = 'A1')$$,
                 '42501', null, 'staff cannot re-assign patient_id');
select throws_ok($$update public.appointments set location_id = (select gonder from ctx) where id = (select id from appt where label = 'A1')$$,
                 '42501', null, 'staff cannot move an appointment to another location');
select throws_ok($$select * from public.staff_create_appointment((select gonder from ctx), (select scaling from ctx), (select meron from ctx),
                   ((select monday from ctx) + time '11:00') at time zone 'Africa/Addis_Ababa', 'Walk In', '+251911000003', 'walk_in')$$,
                 '42501', 'FORBIDDEN', 'staff cannot book at another location');
select lives_ok($$select * from public.staff_create_appointment((select addis from ctx), (select scaling from ctx), (select dawit from ctx),
                  ((select monday from ctx) + time '11:00') at time zone 'Africa/Addis_Ababa', 'Walk In', '+251911000003', 'walk_in')$$,
                'staff can create a walk-in at own location');
select throws_ok($$insert into public.working_hours (dentist_id, location_id, weekday, start_time, end_time)
                   values ((select meron from ctx), (select gonder from ctx), 0, '09:00', '10:00')$$,
                 '42501', null, 'staff cannot edit another location''s working hours');

------------------------------------------------------------------------------
-- staff (Gonder)
------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select is((select count(*)::int from public.appointments), 1, 'Gonder staff sees 1 appointment');
select is((select count(*)::int from public.patients), 1, 'Gonder staff sees 1 patient');

------------------------------------------------------------------------------
-- deactivated staff
------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
select is((select count(*)::int from public.appointments), 0, 'inactive staff sees nothing');

------------------------------------------------------------------------------
-- owner
------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.appointments), 3, 'owner sees all appointments');
select is((select count(*)::int from public.patients), 3, 'owner sees all patients');
select is((select count(*)::int from public.sms_log), 2, 'owner sees all SMS');
select ok((select count(*) from public.audit_log) > 0, 'owner can read audit log');
select lives_ok($$update public.settings set max_reschedules = 4$$, 'owner can update settings');

------------------------------------------------------------------------------
-- verify silent denials (as postgres)
------------------------------------------------------------------------------
reset role;
select is((select internal_notes from public.appointments where id = (select id from appt where label = 'G1')),
          null, 'Addis staff update on Gonder appointment had no effect');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'),
          'staff', 'staff cannot promote themselves');
select is((select auto_confirm from public.settings), false, 'staff cannot change settings');

select * from finish();
rollback;
