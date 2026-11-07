-- SMS outbox: which events queue which messages, rendering, worker claim, resend.
-- Note: the SMS trigger is DEFERRED (fires at commit). Inside this single test transaction we
-- flush pending deferred triggers before assertions with `set constraints all immediate` (then defer again).
begin;
select plan(21);


create temp table ctx as
select d::date as tuesday,
       (select id from public.locations where slug = 'addis-ababa') as addis,
       (select id from public.locations where slug = 'gonder')      as gonder,
       (select id from public.services  where slug = 'scaling')     as scaling,
       (select id from public.dentists  where slug = 'dr-selam-bekele')  as selam,
       (select id from public.dentists  where slug = 'dr-meron-tadesse') as meron
from generate_series((now() at time zone 'Africa/Addis_Ababa')::date + 3,
                     (now() at time zone 'Africa/Addis_Ababa')::date + 9, interval '1 day') d
where extract(dow from d) = 2
limit 1;

create function pg_temp.at(t time) returns timestamptz language sql as $$
  select ((select tuesday from ctx) + t) at time zone 'Africa/Addis_Ababa'
$$;
create function pg_temp.sms(p_appt uuid, p_type text) returns int language sql as $$
  select count(*)::int from public.sms_log where appointment_id = p_appt and type::text = p_type
$$;

update public.settings set owner_alert_phones = array['+251911999999'];

------------------------------------------------------------------------------
-- Online booking → no text to the patient (they hear from us once staff confirm or cancel),
-- but the clinic alert still goes out (location + owner)
------------------------------------------------------------------------------
create temp table b1 as
select x.* from ctx, public.book_appointment(ctx.addis, ctx.scaling, ctx.selam, pg_temp.at('09:00'), 'Abebe Kebede', '+251911000001') x;

set constraints all immediate; set constraints all deferred;
select is((select count(*)::int from public.sms_log where appointment_id = (select appointment_id from b1) and to_phone = '+251911000001'),
          0, 'online booking sends the patient nothing yet');
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from b1), 'clinic_new_booking'), 2, 'clinic alert goes to location alert phone + owner phone');
set constraints all immediate; set constraints all deferred;
select ok((select bool_and(status = 'queued') from public.sms_log where appointment_id = (select appointment_id from b1)), 'all queued');
set constraints all immediate; set constraints all deferred;
select ok((select body from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'clinic_new_booking' limit 1)
          like '%Abebe Kebede +251911000001%', 'clinic alert includes full name and phone');

-- Moving a still-pending booking sends nothing either (the confirmation carries the time)
update public.appointments set starts_at = pg_temp.at('09:30') where id = (select appointment_id from b1);
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from b1), 'booking_rescheduled'), 0, 'moving a pending booking sends nothing');
update public.appointments set starts_at = pg_temp.at('09:00') where id = (select appointment_id from b1);

------------------------------------------------------------------------------
-- Lifecycle
------------------------------------------------------------------------------
update public.appointments set status = 'confirmed' where id = (select appointment_id from b1);
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from b1), 'booking_confirmed'), 1, 'pending → confirmed queues "confirmed"');
set constraints all immediate; set constraints all deferred;
select is((select to_phone from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'booking_confirmed'),
          '+251911000001', '… to the patient');
set constraints all immediate; set constraints all deferred;
select ok((select body from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'booking_confirmed')
          like 'Roha Dental Addis Ababa: Abebe, %', 'patient_name renders as first name');
set constraints all immediate; set constraints all deferred;
select ok((select body from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'booking_confirmed')
          like '% rohadent.com/b/' || (select manage_token from b1), 'short manage_link (no https://) contains the token');
set constraints all immediate; set constraints all deferred;
select ok((select body from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'booking_confirmed')
          like '%09:00%', 'time renders in clinic time (24h)');
set constraints all immediate; set constraints all deferred;
select ok((select body from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'booking_confirmed')
          !~ '\{[a-z_]+\}', 'no unrendered placeholders');

update public.appointments set starts_at = pg_temp.at('10:00') where id = (select appointment_id from b1);
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from b1), 'booking_rescheduled'), 1, 'time change queues "rescheduled"');
set constraints all immediate; set constraints all deferred;
select ok((select body from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'booking_rescheduled')
          like '%10:00%', '… with the new time');

update public.appointments set internal_notes = 'x' where id = (select appointment_id from b1);
set constraints all immediate; set constraints all deferred;
select is((select count(*)::int from public.sms_log where appointment_id = (select appointment_id from b1)), 4,
          'notes-only edit sends nothing');

update public.appointments set status = 'cancelled' where id = (select appointment_id from b1);
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from b1), 'booking_cancelled'), 1, 'cancel queues "cancelled"');

-- Staff phone booking (confirmed) → confirmed SMS, no clinic alert
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'owner@test.local');
insert into public.profiles (id, full_name, role) values ('00000000-0000-0000-0000-0000000000d1', 'Owner', 'owner');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1"}', true);
create temp table b2 as
select x.* from ctx, public.staff_create_appointment(ctx.gonder, ctx.scaling, ctx.meron, pg_temp.at('11:00'), 'Tigist Haile', '+251911000002', 'phone') x;
select set_config('request.jwt.claims', '', true);
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from b2), 'booking_confirmed'), 1, 'staff phone booking queues "confirmed"');
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from b2), 'clinic_new_booking'), 0, '… and no clinic alert');

-- SMS switched off → rows are still logged, as skipped with a reason
update public.settings set sms_enabled = false;
update public.appointments set status = 'cancelled' where id = (select appointment_id from b2);
set constraints all immediate; set constraints all deferred;
select is((select status::text || ' / ' || error from public.sms_log where appointment_id = (select appointment_id from b2) and type = 'booking_cancelled'),
          'skipped / SMS is turned off in settings', 'disabled SMS is logged as skipped, never silent');
update public.settings set sms_enabled = true;

------------------------------------------------------------------------------
-- Worker claim + resend
------------------------------------------------------------------------------
set constraints all immediate; set constraints all deferred;
select ok((select count(*) from public.claim_sms_batch(100)) > 0, 'worker claims queued rows');
set constraints all immediate; set constraints all deferred;
select is((select count(*)::int from public.claim_sms_batch(100)), 0, 'claimed rows are not handed out twice');

select lives_ok($$select public.resend_sms((select id from public.sms_log where appointment_id = (select appointment_id from b1) limit 1))$$,
                'postgres/service can resend');

select * from finish();
rollback;
