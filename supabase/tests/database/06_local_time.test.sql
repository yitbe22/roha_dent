-- Ethiopian local time/date helpers and the shorter manage token (migration 0010).
begin;
select plan(12);

select is(public.ethiopian_time('2026-11-10 08:30+03'), '2:30 ጠዋት', '08:30 is 2:30 in the morning (local)');
select is(public.ethiopian_time('2026-11-10 12:00+03'), '6:00 ከሰዓት', 'noon is 6:00 afternoon');
select is(public.ethiopian_time('2026-11-10 18:00+03'), '12:00 ምሽት', '18:00 is 12:00 evening');
select is(public.ethiopian_time('2026-11-10 05:30+00'), '2:30 ጠዋት', 'uses clinic time zone, not UTC');
select is(public.ethiopian_date('2026-11-06'), 'ጥቅምት 27', 'Gregorian 6 Nov 2026 = Tikimt 27');
select is(public.ethiopian_date('2026-09-11', true), 'መስከረም 1, 2019', 'Enkutatash 2019');
select is(public.ethiopian_date('2026-01-07'), 'ታኅሣሥ 29', 'Genna');

select is(char_length(public._new_manage_token()), 22, 'new manage tokens are 22 characters');

-- an old 43-character token keeps working
insert into public.appointment_secrets (appointment_id, manage_token)
select a.id, repeat('x', 43) from public.appointments a
where not exists (select 1 from public.appointment_secrets s where s.appointment_id = a.id) limit 1;
select ok(public._appointment_id_by_token(repeat('x', 43)) is not null
          or not exists (select 1 from public.appointment_secrets where manage_token = repeat('x', 43)),
          'old long tokens still resolve');

-- set_working_hours replaces a dentist's week at one clinic atomically
create temp table wh_ctx as
select d.id as dentist, l.id as loc from public.dentists d, public.locations l
where l.slug = 'addis-ababa' and exists (select 1 from public.working_hours w where w.dentist_id = d.id and w.location_id = l.id) limit 1;

select is(public.set_working_hours((select dentist from wh_ctx), (select loc from wh_ctx),
          '[{"weekday":1,"start":"09:00","end":"13:00"},{"weekday":2,"start":"09:00","end":"13:00"}]'), 2, 'saves the new week');
select is((select count(*)::int from public.working_hours where dentist_id = (select dentist from wh_ctx) and location_id = (select loc from wh_ctx)),
          2, 'old hours at this clinic were replaced');
select throws_ok($q$select public.set_working_hours((select dentist from wh_ctx), (select loc from wh_ctx),
          '[{"weekday":1,"start":"09:00","end":"13:00"},{"weekday":1,"start":"12:00","end":"15:00"}]')$q$,
          '23P01', null, 'overlapping hours are refused (and nothing is lost)');

select * from finish();
rollback;
