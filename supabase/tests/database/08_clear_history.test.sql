-- admin_clear_history (migration 0014). Run: `supabase test db` or `npm run db:verify`.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'owner@clear.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'staff@clear.local');
insert into public.profiles (id, full_name, role, location_id, is_active) values
  ('00000000-0000-0000-0000-0000000000c1', 'Owner', 'owner', null, true),
  ('00000000-0000-0000-0000-0000000000c2', 'Staff', 'staff', (select id from public.locations where slug = 'addis-ababa'), true);

-- A booked patient, a delivered text and one still waiting in the outbox
create temp table b as
select bk.appointment_id
from public.book_appointment(
  (select id from public.locations where slug = 'addis-ababa'),
  (select id from public.services where slug = 'scaling'),
  (select id from public.dentists where slug = 'dr-selam-bekele'),
  ((select d from generate_series((now() at time zone 'Africa/Addis_Ababa')::date + 3,
                                   (now() at time zone 'Africa/Addis_Ababa')::date + 9, interval '1 day') d
     where extract(dow from d) = 1 limit 1)::date + time '09:00') at time zone 'Africa/Addis_Ababa',
  'Test Patient', '+251911000077') bk;
delete from public.sms_log;
insert into public.sms_log (appointment_id, type, to_phone, body, status) values
  ((select appointment_id from b), 'booking_received', '+251911000077', 'old', 'delivered'),
  ((select appointment_id from b), 'booking_confirmed', '+251911000077', 'pending', 'queued');
grant select on b to authenticated;

-- Staff (not owner) is refused
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$select public.admin_clear_history('sms')$$, '42501', null, 'staff cannot clear history');

-- Owner
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.admin_clear_history('everything')$$, '22023', null, 'unknown history is rejected');

select is((public.admin_clear_history('sms') ->> 'deleted')::int, 1, 'clearing texts deletes the sent one');
reset role;
select is((select count(*)::int from public.sms_log), 1, 'a text still waiting to be sent is kept');
select is((select status::text from public.sms_log), 'queued', '…and it is the queued one');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(public.admin_clear_history('patients'), '{"deleted": 1, "appointments_deleted": 1}'::jsonb, 'clearing patients reports what went');
reset role;
select is((select count(*)::int from public.patients), 0, 'no patients left');
select is((select count(*)::int from public.appointments), 0, 'no appointments left');
select is((select appointment_id from public.sms_log), null, 'kept texts lose the link to the deleted appointment');
select is((select count(*)::int from public.audit_log where entity = 'appointments' and action = 'delete'), 0,
          'deleted appointments are not copied into the change history');
select is((select count(*)::int from public.audit_log where action = 'clear_history'), 2, 'each clear is recorded once');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select ok((public.admin_clear_history('activity') ->> 'deleted')::int >= 2, 'clearing the change history');
reset role;
select is((select array_agg(entity) from public.audit_log), array['activity'], 'only the "cleared" note remains');

select * from finish();
rollback;
