-- One phone number can't hold two overlapping appointments online (migration 0018).
-- Run: `supabase test db` or `npm run db:verify`.
begin;
select plan(8);

create temp table ctx as
select d::date as monday,
       (select id from public.locations where slug = 'addis-ababa')      as addis,
       (select id from public.services  where slug = 'scaling')          as scaling,
       (select id from public.services  where slug = 'checkup')          as checkup,
       (select id from public.dentists  where slug = 'dr-selam-bekele')  as selam,
       (select id from public.dentists  where slug = 'dr-dawit-alemu')   as dawit
from generate_series((now() at time zone 'Africa/Addis_Ababa')::date + 3,
                     (now() at time zone 'Africa/Addis_Ababa')::date + 9, interval '1 day') d
where extract(dow from d) = 1
limit 1;
create function pg_temp.at(t time) returns timestamptz language sql as $$
  select ((select monday from ctx) + t) at time zone 'Africa/Addis_Ababa'
$$;

-- Abebe: scaling 09:00–09:45 with Selam
create temp table a1 as
select b.* from ctx, public.book_appointment(ctx.addis, ctx.scaling, ctx.selam, pg_temp.at('09:00'), 'Abebe Kebede', '+251911000301') b;

select throws_ok($$select * from public.book_appointment((select addis from ctx), (select checkup from ctx), (select dawit from ctx),
                   pg_temp.at('09:00'), 'Abebe Kebede', '+251911000301')$$,
                 'P0001', 'PATIENT_TIME_CONFLICT', 'same phone, same time, other service and dentist → refused');
select throws_ok($$select * from public.book_appointment((select addis from ctx), (select checkup from ctx), (select dawit from ctx),
                   pg_temp.at('09:30'), 'Abebe Kebede', '+251911000301')$$,
                 'P0001', 'PATIENT_TIME_CONFLICT', 'overlapping (not identical) time → refused');
select lives_ok($$select * from public.book_appointment((select addis from ctx), (select checkup from ctx), (select dawit from ctx),
                  pg_temp.at('09:00'), 'Sara Kebede', '+251911000302')$$,
                'another phone at the same time is fine (other dentist free)');

create temp table a2 as
select b.* from ctx, public.book_appointment(ctx.addis, ctx.scaling, ctx.selam, pg_temp.at('10:00'), 'Abebe Kebede', '+251911000301') b;
select is((select count(*)::int from a2), 1, 'same phone at a later, non-overlapping time is fine');

-- Patient moves the 10:00 booking onto their own 09:00 time with the manage link → refused
select throws_ok($$select public.reschedule_appointment_by_token((select manage_token from a2), pg_temp.at('09:30'), (select dawit from ctx))$$,
                 'P0001', 'PATIENT_TIME_CONFLICT', 'moving onto one''s own other appointment → refused');

-- Staff may book a family member on the same phone at the same time
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'owner@overlap.local');
insert into public.profiles (id, full_name, role) values ('00000000-0000-0000-0000-0000000000e1', 'Owner', 'owner');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1"}', true);
select lives_ok($$select * from public.staff_create_appointment((select addis from ctx), (select checkup from ctx), (select dawit from ctx),
                  pg_temp.at('11:00'), 'Abebe Kebede', '+251911000301', 'phone')$$, 'setup: staff booking at 11:00');
select lives_ok($$select * from public.staff_create_appointment((select addis from ctx), (select scaling from ctx), (select selam from ctx),
                  pg_temp.at('11:00'), 'Abebe Kebede', '+251911000301', 'phone')$$,
                'staff can book a second family member on the same phone at the same time');
select set_config('request.jwt.claims', '', true);

-- A cancelled appointment doesn't block the time
create temp table a3 as
select b.* from ctx, public.book_appointment(ctx.addis, ctx.scaling, ctx.selam, pg_temp.at('14:00'), 'Liya Tesfaye', '+251911000303') b;
update public.appointments set status = 'cancelled' where id = (select appointment_id from a3);
select lives_ok($$select * from public.book_appointment((select addis from ctx), (select checkup from ctx), (select dawit from ctx),
                  pg_temp.at('14:00'), 'Liya Tesfaye', '+251911000303')$$,
                'after cancelling, the time is free for that phone again');

select * from finish();
rollback;
