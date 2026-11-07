-- admin_delete_history (migration 0015). Run: `supabase test db` or `npm run db:verify`.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'owner@select.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'staff@select.local');
insert into public.profiles (id, full_name, role, location_id, is_active) values
  ('00000000-0000-0000-0000-0000000000d1', 'Owner', 'owner', null, true),
  ('00000000-0000-0000-0000-0000000000d2', 'Staff', 'staff', (select id from public.locations where slug = 'addis-ababa'), true);

-- Two booked patients on the next Monday at least 3 days out
create temp table ctx as
select ((select d from generate_series((now() at time zone 'Africa/Addis_Ababa')::date + 3,
                                        (now() at time zone 'Africa/Addis_Ababa')::date + 9, interval '1 day') d
          where extract(dow from d) = 1 limit 1)::date) as monday;
create temp table b (who text, appointment_id uuid);
insert into b select 'keep', bk.appointment_id from ctx, public.book_appointment(
  (select id from public.locations where slug = 'addis-ababa'), (select id from public.services where slug = 'scaling'),
  (select id from public.dentists where slug = 'dr-selam-bekele'), (ctx.monday + time '09:00') at time zone 'Africa/Addis_Ababa',
  'Keep Me', '+251911000081') bk;
insert into b select 'drop', bk.appointment_id from ctx, public.book_appointment(
  (select id from public.locations where slug = 'addis-ababa'), (select id from public.services where slug = 'scaling'),
  (select id from public.dentists where slug = 'dr-selam-bekele'), (ctx.monday + time '10:00') at time zone 'Africa/Addis_Ababa',
  'Drop Me', '+251911000082') bk;
delete from public.sms_log;
insert into public.sms_log (id, type, to_phone, body, status) values
  ('00000000-0000-0000-0000-00000000d001', 'booking_received', '+251911000081', 'a', 'delivered'),
  ('00000000-0000-0000-0000-00000000d002', 'booking_received', '+251911000082', 'b', 'delivered'),
  ('00000000-0000-0000-0000-00000000d003', 'booking_received', '+251911000082', 'c', 'queued');
create temp table pids as select p.id::text as id from public.patients p where p.full_name = 'Drop Me';
grant select on pids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select throws_ok($$select public.admin_delete_history('sms', array['00000000-0000-0000-0000-00000000d001'])$$, '42501', null,
                 'staff cannot delete selected history');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((public.admin_delete_history('sms', array['00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d003']) ->> 'deleted')::int,
          1, 'only the selected, already-sent text is deleted');
select is(public.admin_delete_history('sms', array[]::text[]), '{"deleted": 0, "appointments_deleted": 0}'::jsonb, 'nothing selected → nothing deleted');
select is(public.admin_delete_history('patients', (select array_agg(id) from pids)), '{"deleted": 1, "appointments_deleted": 1}'::jsonb,
          'deleting a selected patient takes their appointments');
reset role;
select is((select array_agg(id::text order by id) from public.sms_log),
          array['00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000d003'], 'unselected and queued texts remain');
select is((select array_agg(full_name) from public.patients), array['Keep Me'], 'the other patient remains');
select is((select count(*)::int from public.appointments), 1, 'their appointment remains');
select is((select count(*)::int from public.audit_log where action = 'delete_selected'), 2, 'each real delete is noted once (an empty one is not)');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((public.admin_delete_history('activity', (select array_agg(id::text) from public.audit_log where action = 'delete_selected')) ->> 'deleted')::int,
          2, 'selected change-history entries are deleted');
reset role;
select is((select count(*)::int from public.audit_log where action = 'delete_selected'), 1, 'only the new note remains');

select * from finish();
rollback;
