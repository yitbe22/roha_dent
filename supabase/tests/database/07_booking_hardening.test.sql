-- Migration 0011: online bookings cannot rename patients or smuggle links into SMS.
begin;
select plan(7);

-- existing patient
insert into public.patients (phone, full_name) values ('+251911777001', 'Tigist Haile');

select is(public._upsert_patient('+251911777001', 'Someone Else'),
          (select id from public.patients where phone = '+251911777001'), 'same phone returns the existing patient');
select is((select full_name from public.patients where phone = '+251911777001'), 'Tigist Haile',
          'an online booking does not overwrite the saved name');
select lives_ok($$select public._upsert_patient('+251911777002', 'አበበ ከበደ')$$, 'Amharic names are accepted');
select lives_ok($$select public._upsert_patient('+251911777003', 'Mary-Jane O''Neil')$$, 'hyphen and apostrophe are accepted');
select throws_ok($$select public._upsert_patient('+251911777004', 'Win prize at evil.com')$$,
                 'P0001', 'INVALID_NAME', 'a web address in the name is rejected');
select throws_ok($$select public._upsert_patient('+251911777005', 'Visit https: now')$$,
                 'P0001', 'INVALID_NAME', 'https: in the name is rejected');
select throws_ok($$select public._upsert_patient('+251911777006', 'Call 0911223344')$$,
                 'P0001', 'INVALID_NAME', 'digits in the name are rejected');

select * from finish();
rollback;
