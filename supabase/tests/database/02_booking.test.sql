-- Booking, slot calculation and double-booking tests (run as postgres / service role).
begin;
select plan(38);

create temp table ctx as
select d::date as monday,
       (select id from public.locations where slug = 'addis-ababa') as addis,
       (select id from public.locations where slug = 'gonder')      as gonder,
       (select id from public.services  where slug = 'scaling')     as scaling,
       (select id from public.services  where slug = 'root-canal')  as root_canal,
       (select id from public.dentists  where slug = 'dr-selam-bekele')  as selam,
       (select id from public.dentists  where slug = 'dr-dawit-alemu')   as dawit,
       (select id from public.dentists  where slug = 'dr-meron-tadesse') as meron,
       (select id from public.dentists  where slug = 'dr-yonas-girma')   as yonas
from generate_series((now() at time zone 'Africa/Addis_Ababa')::date + 3,
                     (now() at time zone 'Africa/Addis_Ababa')::date + 9, interval '1 day') d
where extract(dow from d) = 1
limit 1;

-- local wall-clock time on the test Monday (+ day offset) → timestamptz
create function pg_temp.at(t time, day_offset int default 0) returns timestamptz language sql as $$
  select ((select monday from ctx) + day_offset + t) at time zone 'Africa/Addis_Ababa'
$$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'owner@test.local');
insert into public.profiles (id, full_name, role) values ('00000000-0000-0000-0000-0000000000b1', 'Owner', 'owner');

create temp table appt (label text primary key, id uuid, token text, dentist uuid, status text);

------------------------------------------------------------------------------
-- Slot generation
------------------------------------------------------------------------------
select ok(exists (select 1 from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday, ctx.selam) s
                  where s.starts_at = pg_temp.at('08:30')), 'first slot starts at opening time 08:30');
select ok(not exists (select 1 from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday, ctx.selam) s
                      where s.starts_at < pg_temp.at('08:30')), 'no slot before opening');
select ok(exists (select 1 from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday, ctx.selam) s
                  where s.starts_at = pg_temp.at('11:45')), '45-min service fits 11:45–12:30');
select ok(not exists (select 1 from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday, ctx.selam) s
                      where s.starts_at = pg_temp.at('12:00')), 'slot overlapping lunch is not offered');
select ok(not exists (select 1 from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday, ctx.selam) s
                      where s.starts_at > pg_temp.at('16:45')), 'last slot ends by closing (16:45 + 45 = 17:30)');
select ok(not exists (select 1 from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday, ctx.selam) s
                      where extract(minute from s.starts_at)::int % 15 <> 0), 'slots are on the 15-minute grid');
select is((select count(*)::int from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday - 1)), 0,
          'no slots on Sunday');
select is((select count(*)::int from ctx, public.get_available_slots(ctx.addis, ctx.scaling,
          (now() at time zone 'Africa/Addis_Ababa')::date - 1)), 0, 'no slots in the past');
select is((select count(*)::int from ctx, public.get_available_slots(ctx.addis, ctx.scaling,
          (now() at time zone 'Africa/Addis_Ababa')::date + 90)), 0, 'no slots beyond max_advance_days');
select is((select count(*)::int from ctx, public.get_available_slots(ctx.addis, ctx.root_canal, ctx.monday, ctx.yonas)), 0,
          'dentist who does not offer the service has no slots');
select is((select count(*)::int from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday + 3, ctx.yonas)), 0,
          'multi-location dentist: no Addis slots on his Gonder day (Thu)');
select ok((select count(*) from ctx, public.get_available_slots(ctx.gonder, ctx.scaling, ctx.monday + 3, ctx.yonas)) > 0,
          'multi-location dentist: Gonder slots on Thu');
select ok((select count(*) from ctx, public.get_available_dates(ctx.addis, ctx.scaling, ctx.monday, ctx.monday + 6)
           where slot_count > 0) = 6, 'get_available_dates: Mon–Sat open, Sun closed');
select throws_ok($$select * from public.get_available_dates((select addis from ctx), (select scaling from ctx), current_date, current_date + 100)$$,
                 'P0001', 'INVALID_DATE_RANGE', 'date range is capped');

------------------------------------------------------------------------------
-- Booking + double-booking
------------------------------------------------------------------------------
insert into appt
select 'B1', b.appointment_id, b.manage_token, b.dentist_id, b.status::text
from ctx, public.book_appointment(ctx.addis, ctx.scaling, ctx.selam, pg_temp.at('09:00'), '  Abebe   Kebede ', '+251911000001', 'Sensitive gums') b;

select is((select status from appt where label = 'B1'), 'pending', 'online booking starts as pending');
select is((select char_length(token) from appt where label = 'B1'), 43, 'manage token is 43 chars (256-bit base64url)');
select is((select full_name from public.patients where phone = '+251911000001'), 'Abebe Kebede', 'patient name is trimmed/collapsed');
select throws_ok($$select * from public.book_appointment((select addis from ctx), (select scaling from ctx), (select selam from ctx),
                   pg_temp.at('09:00'), 'Other Person', '+251911000002')$$,
                 'P0001', 'SLOT_UNAVAILABLE', 'same dentist + same slot cannot be booked twice');
select throws_ok($$select * from public.book_appointment((select addis from ctx), (select scaling from ctx), (select selam from ctx),
                   pg_temp.at('09:30'), 'Other Person', '+251911000002')$$,
                 'P0001', 'SLOT_UNAVAILABLE', 'overlapping slot cannot be booked');
select throws_ok($$insert into public.appointments (location_id, dentist_id, service_id, patient_id, starts_at, ends_at, status)
                   select addis, selam, scaling, (select id from public.patients limit 1), pg_temp.at('09:15'), pg_temp.at('10:00'), 'pending' from ctx$$,
                 '23P01', null, 'exclusion constraint blocks overlaps even for direct inserts');

-- "any available" fills the remaining dentists, least-booked first, then runs out
insert into appt
select 'ANY1', b.appointment_id, b.manage_token, b.dentist_id, b.status::text
from ctx, public.book_appointment(ctx.addis, ctx.scaling, null, pg_temp.at('09:00'), 'Any One', '+251911000011') b;
insert into appt
select 'ANY2', b.appointment_id, b.manage_token, b.dentist_id, b.status::text
from ctx, public.book_appointment(ctx.addis, ctx.scaling, null, pg_temp.at('09:00'), 'Any Two', '+251911000012') b;
select ok((select count(distinct dentist) from appt where label in ('B1', 'ANY1', 'ANY2')) = 3,
          '"any dentist" assigns a different free dentist each time');
select throws_ok($$select * from public.book_appointment((select addis from ctx), (select scaling from ctx), null,
                   pg_temp.at('09:00'), 'Any Three', '+251911000013')$$,
                 'P0001', 'SLOT_UNAVAILABLE', '"any dentist" fails when everyone is booked');

-- cross-location: Yonas booked in Addis Mon 10:00 cannot be booked at Gonder at the same time
insert into appt
select 'Y1', b.appointment_id, b.manage_token, b.dentist_id, b.status::text
from ctx, public.book_appointment(ctx.addis, ctx.scaling, ctx.yonas, pg_temp.at('10:00'), 'Yared Tesfaye', '+251911000021') b;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
select throws_ok($$select * from public.staff_create_appointment((select gonder from ctx), (select scaling from ctx), (select yonas from ctx),
                   pg_temp.at('10:00'), 'Walk In', '+251911000022', 'walk_in')$$,
                 'P0001', 'SLOT_UNAVAILABLE', 'a dentist cannot be double-booked across locations');
select set_config('request.jwt.claims', '', true);

-- validation
select throws_ok($$select * from public.book_appointment((select addis from ctx), (select scaling from ctx), null, pg_temp.at('14:00'), 'Bad Phone', '0911000001')$$,
                 'P0001', 'INVALID_PHONE', 'non-E.164 phone rejected');
select throws_ok($$select * from public.book_appointment((select addis from ctx), (select scaling from ctx), null, pg_temp.at('14:00'), 'Safaricom', '+251711000001')$$,
                 'P0001', 'INVALID_PHONE', 'Safaricom (07) numbers rejected for now');
select throws_ok($$select * from public.book_appointment((select addis from ctx), (select scaling from ctx), null, pg_temp.at('14:00'), 'X', '+251911000031')$$,
                 'P0001', 'INVALID_NAME', 'too-short name rejected');
select throws_ok($$select * from public.book_appointment((select addis from ctx), (select scaling from ctx), null, pg_temp.at('14:07'), 'Off Grid', '+251911000031')$$,
                 'P0001', 'SLOT_UNAVAILABLE', 'start time off the slot grid rejected');

-- per-patient cap (default 3 active future bookings): B1 + 2 more OK, 4th refused
select lives_ok($$select * from public.book_appointment((select addis from ctx), (select scaling from ctx), null, pg_temp.at('14:00'), 'Abebe Kebede', '+251911000001')$$,
                'same patient can book again');
select lives_ok($$select * from public.book_appointment((select addis from ctx), (select scaling from ctx), null, pg_temp.at('15:00'), 'Abebe K.', '+251911000001')$$,
                'same patient, third booking');
select throws_ok($$select * from public.book_appointment((select addis from ctx), (select scaling from ctx), null, pg_temp.at('16:00'), 'Abebe Kebede', '+251911000001')$$,
                 'P0001', 'TOO_MANY_ACTIVE_BOOKINGS', 'fourth active booking refused');
select is((select count(*)::int from public.patients where phone = '+251911000001'), 1, 'one patient row per phone');

------------------------------------------------------------------------------
-- Manage by token
------------------------------------------------------------------------------
select is((public.get_appointment_by_token((select token from appt where label = 'B1')) ->> 'can_cancel'), 'true',
          'token lookup works and allows cancelling');
select is(public.get_appointment_by_token('this-is-not-a-real-token-but-long-enough-xx'), null, 'unknown token returns null');

select is((public.reschedule_appointment_by_token((select token from appt where label = 'ANY1'), pg_temp.at('13:30')) ->> 'starts_at')::timestamptz,
          pg_temp.at('13:30'), 'reschedule by token moves the appointment');
select is((select reschedule_count from public.appointments where id = (select id from appt where label = 'ANY1')), 1,
          'reschedule_count incremented');

select is((public.cancel_appointment_by_token((select token from appt where label = 'B1'), 'Feeling better') ->> 'status'),
          'cancelled', 'cancel by token');
select ok(exists (select 1 from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday, ctx.selam) s
                  where s.starts_at = pg_temp.at('09:00')), 'cancelled slot becomes available again');
select throws_ok($$select public.cancel_appointment_by_token((select token from appt where label = 'B1'))$$,
                 'P0001', 'CANNOT_CANCEL', 'cannot cancel twice');

select * from finish();
rollback;
