-- SMS outbox: which events queue which messages, rendering, reminders, worker claim, resend.
-- Note: the SMS trigger is DEFERRED (fires at commit). Inside this single test transaction we
-- flush pending deferred triggers before assertions with `set constraints all immediate` (then defer again).
begin;
select plan(26);


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
-- Online booking → received (patient) + clinic alert (location + owner)
------------------------------------------------------------------------------
create temp table b1 as
select x.* from ctx, public.book_appointment(ctx.addis, ctx.scaling, ctx.selam, pg_temp.at('09:00'), 'Abebe Kebede', '+251911000001') x;

set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from b1), 'booking_received'), 1, 'online booking queues "booking received"');
set constraints all immediate; set constraints all deferred;
select is((select to_phone from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'booking_received'),
          '+251911000001', '… to the patient');
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from b1), 'clinic_new_booking'), 2, 'clinic alert goes to location alert phone + owner phone');
set constraints all immediate; set constraints all deferred;
select ok((select bool_and(status = 'queued') from public.sms_log where appointment_id = (select appointment_id from b1)), 'all queued');

set constraints all immediate; set constraints all deferred;
select ok((select body from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'booking_received')
          like 'Roha Dental: Hi Abebe, %', 'patient_name renders as first name');
set constraints all immediate; set constraints all deferred;
select ok((select body from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'booking_received')
          like '%/booking/' || (select manage_token from b1), 'manage_link contains the token (secret exists at commit time)');
set constraints all immediate; set constraints all deferred;
select ok((select body from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'booking_received')
          like '%09:00%', 'time renders in clinic time (24h)');
set constraints all immediate; set constraints all deferred;
select ok((select body from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'booking_received')
          !~ '\{[a-z_]+\}', 'no unrendered placeholders');
set constraints all immediate; set constraints all deferred;
select ok((select body from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'clinic_new_booking' limit 1)
          like '%Abebe Kebede +251911000001%', 'clinic alert includes full name and phone');

------------------------------------------------------------------------------
-- Lifecycle
------------------------------------------------------------------------------
update public.appointments set status = 'confirmed' where id = (select appointment_id from b1);
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from b1), 'booking_confirmed'), 1, 'pending → confirmed queues "confirmed"');

update public.appointments set starts_at = pg_temp.at('10:00') where id = (select appointment_id from b1);
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from b1), 'booking_rescheduled'), 1, 'time change queues "rescheduled"');
set constraints all immediate; set constraints all deferred;
select ok((select body from public.sms_log where appointment_id = (select appointment_id from b1) and type = 'booking_rescheduled')
          like '%10:00%', '… with the new time');

update public.appointments set internal_notes = 'x' where id = (select appointment_id from b1);
set constraints all immediate; set constraints all deferred;
select is((select count(*)::int from public.sms_log where appointment_id = (select appointment_id from b1)), 5,
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
-- Reminders
------------------------------------------------------------------------------
create temp table r as
select x.* from ctx, public.book_appointment(ctx.gonder, ctx.scaling, ctx.meron, pg_temp.at('15:00'), 'Reminder Test', '+251911000003') x;
-- Pretend it was booked 3 days ago, is confirmed, and starts in 20 hours.
update public.appointments
   set status = 'confirmed', created_at = now() - interval '3 days',
       starts_at = date_trunc('minute', now()) + interval '20 hours', ends_at = date_trunc('minute', now()) + interval '20 hours 45 minutes'
 where id = (select appointment_id from r);

set constraints all immediate; set constraints all deferred;
select is(public.enqueue_due_reminders() >= 1, true, 'due 24h reminder is queued');
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from r), 'reminder_24h'), 1, '… exactly one');
set constraints all immediate; set constraints all deferred;
select is(public.enqueue_due_reminders(), 0, 'running again queues nothing (idempotent)');
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from r), 'reminder_2h'), 0, 'no 2h reminder yet');

update public.appointments
   set starts_at = date_trunc('minute', now()) + interval '90 minutes', ends_at = date_trunc('minute', now()) + interval '135 minutes'
 where id = (select appointment_id from r);
set constraints all immediate; set constraints all deferred;
select is(public.enqueue_due_reminders() >= 1, true, '2h reminder queued once within 2 hours');
set constraints all immediate; set constraints all deferred;
select is(pg_temp.sms((select appointment_id from r), 'reminder_2h'), 1, '… exactly one 2h reminder');

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
