-- Time off, closures, auto-confirm, workflow trigger and audit log.
begin;
select plan(12);

create temp table ctx as
select d::date as monday,
       (select id from public.locations where slug = 'addis-ababa') as addis,
       (select id from public.locations where slug = 'gonder')      as gonder,
       (select id from public.services  where slug = 'scaling')     as scaling,
       (select id from public.services  where slug = 'root-canal')  as root_canal,
       (select id from public.dentists  where slug = 'dr-dawit-alemu')   as dawit,
       (select id from public.dentists  where slug = 'dr-meron-tadesse') as meron
from generate_series((now() at time zone 'Africa/Addis_Ababa')::date + 3,
                     (now() at time zone 'Africa/Addis_Ababa')::date + 9, interval '1 day') d
where extract(dow from d) = 1
limit 1;

create function pg_temp.at(t time) returns timestamptz language sql as $$
  select ((select monday from ctx) + t) at time zone 'Africa/Addis_Ababa'
$$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'addis@test.local');
insert into public.profiles (id, full_name, role, location_id)
values ('00000000-0000-0000-0000-0000000000c1', 'Addis Staff', 'staff', (select addis from ctx));

-- Dentist time off (morning)
insert into public.time_off (dentist_id, location_id, starts_at, ends_at, reason)
select dawit, null, pg_temp.at('08:00'), pg_temp.at('12:30'), 'Conference' from ctx;
select ok(not exists (select 1 from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday, ctx.dawit) s
                      where s.starts_at < pg_temp.at('12:30')), 'dentist time off removes overlapping slots');
select ok(exists (select 1 from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday, ctx.dawit) s
                  where s.starts_at = pg_temp.at('13:30')), '… but afternoon slots remain');

-- Whole-location closure
insert into public.time_off (dentist_id, location_id, starts_at, ends_at, reason)
select null, gonder, pg_temp.at('00:00'), pg_temp.at('23:59'), 'Public holiday' from ctx;
select is((select count(*)::int from ctx, public.get_available_slots(ctx.gonder, ctx.scaling, ctx.monday)), 0,
          'location closure removes all slots at that location');
select ok((select count(*) from ctx, public.get_available_slots(ctx.addis, ctx.scaling, ctx.monday)) > 0,
          '… and does not affect the other location');

-- Auto-confirm
update public.settings set auto_confirm = true;
create temp table b as
select * from ctx, public.book_appointment(ctx.addis, ctx.root_canal, ctx.dawit, pg_temp.at('14:00'), 'Kidist Mulugeta', '+251922000001') x;
grant select on b, ctx to authenticated;
select is((select status::text from b), 'confirmed', 'auto_confirm books straight to confirmed');
select is((select confirmed_at is not null from public.appointments where id = (select appointment_id from b)), true,
          '… with confirmed_at');
select is((select ends_at - starts_at from public.appointments where id = (select appointment_id from b)), interval '90 minutes',
          'ends_at uses service duration (root canal 90 min)');

-- Staff moves it: trigger keeps the length and resets reminders
update public.appointments set reminder_24h_sent_at = now() where id = (select appointment_id from b);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
update public.appointments set starts_at = pg_temp.at('15:00') where id = (select appointment_id from b);
update public.appointments set status = 'cancelled' where id = (select appointment_id from b);
reset role;
select set_config('request.jwt.claims', '', true);

select is((select ends_at from public.appointments where id = (select appointment_id from b)), pg_temp.at('16:30'),
          'moving keeps the duration');
select is((select reminder_24h_sent_at from public.appointments where id = (select appointment_id from b)), null,
          'moving resets reminder flags');
select is((select cancelled_by from public.appointments where id = (select appointment_id from b)), 'staff',
          'cancel by staff recorded as staff');
select ok(exists (select 1 from public.audit_log
                  where entity = 'appointments' and entity_id = (select appointment_id::text from b)
                    and action = 'status:cancelled' and actor_type = 'staff'
                    and actor_id = '00000000-0000-0000-0000-0000000000c1'), 'audit log records who cancelled');
select ok(exists (select 1 from public.audit_log
                  where entity = 'appointments' and entity_id = (select appointment_id::text from b)
                    and action = 'update' and changes ? 'starts_at'), 'audit log records the time change');

select * from finish();
rollback;
