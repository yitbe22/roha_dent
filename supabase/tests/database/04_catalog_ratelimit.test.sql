-- Booking catalog, rate limiter and manage-token storage.
begin;
select plan(10);

-- catalog (anon)
set local role anon;
select is(jsonb_array_length(public.get_booking_catalog() -> 'locations'), 2, 'catalog: 2 locations');
select is(jsonb_array_length(public.get_booking_catalog() -> 'services'), 7, 'catalog: 7 bookable services');
select is((select jsonb_array_length(d -> 'location_ids') from jsonb_array_elements(public.get_booking_catalog() -> 'dentists') d
           where d ->> 'slug' = 'dr-yonas-girma'), 2, 'catalog: multi-location dentist lists both clinics');
select ok((public.get_booking_catalog() -> 'settings' ->> 'max_advance_days')::int > 0, 'catalog: includes booking settings');
select throws_ok($$select public.hit_rate_limit('x', 1, 60)$$, '42501', null, 'anon cannot call the rate limiter');
reset role;

-- rate limiter (service role / postgres)
select is(public.hit_rate_limit('test:bucket', 2, 3600), true,  'rate limit: 1st hit allowed');
select is(public.hit_rate_limit('test:bucket', 2, 3600), true,  'rate limit: 2nd hit allowed');
select is(public.hit_rate_limit('test:bucket', 2, 3600), false, 'rate limit: 3rd hit blocked');

-- manage token is stored in appointment_secrets and resolves the appointment
create temp table b as
select x.* from public.book_appointment(
  (select id from public.locations where slug = 'addis-ababa'),
  (select id from public.services where slug = 'scaling'),
  null,
  (select min(s.starts_at) from public.get_available_slots(
     (select id from public.locations where slug = 'addis-ababa'),
     (select id from public.services where slug = 'scaling'),
     (select d::date from generate_series((now() at time zone 'Africa/Addis_Ababa')::date + 3,
                                          (now() at time zone 'Africa/Addis_Ababa')::date + 9, interval '1 day') d
      where extract(dow from d) = 2 limit 1)) s),
  'Token Test', '+251933000001') x;
select is((select manage_token from public.appointment_secrets where appointment_id = (select appointment_id from b)),
          (select manage_token from b), 'token stored for the appointment');
select is((public.get_appointment_by_token((select manage_token from b)) ->> 'id')::uuid,
          (select appointment_id from b), 'token resolves to the appointment');

select * from finish();
rollback;
