-- seed.sql — demo/reference data. Runs automatically on `supabase db reset` (local).
-- For production run it once:  psql "$SUPABASE_DB_URL" -f supabase/seed.sql
-- It is idempotent (upserts by slug).
--
-- ⚠ PLACEHOLDERS — replace before launch:
--   * street addresses, coordinates and map links of both clinics
--   * all four dentist profiles (names, bios, photos, services, hours)
--   * alert_phone of each location (receives "new booking" SMS)

------------------------------------------------------------------------------
-- Locations
------------------------------------------------------------------------------
insert into public.locations
  (slug, name, city, address, phone, whatsapp, alert_phone, map_url, latitude, longitude, opening_hours_note, sort_order)
values
  ('addis-ababa', 'Roha Speciality Dental Center — Addis Ababa', 'Addis Ababa',
   'Bole Road, Addis Ababa, Ethiopia (placeholder address)',
   '+251 94 604 0506', '251946040506', '+251946040506',
   'https://www.google.com/maps/search/?api=1&query=Roha+Speciality+Dental+Center+Addis+Ababa',
   9.010800, 38.761300, 'Mon–Sat 8:30–17:30 · Sun closed', 1),
  ('gonder', 'Roha Speciality Dental Center — Gonder', 'Gonder',
   'Piazza, Gonder, Ethiopia (placeholder address)',
   '+251 92 364 5456', '251923645456', '+251923645456',
   'https://www.google.com/maps/search/?api=1&query=Roha+Speciality+Dental+Center+Gonder',
   12.603000, 37.452100, 'Mon–Sat 8:30–17:30 · Sun closed', 2)
on conflict (slug) do update set
  name = excluded.name, city = excluded.city, phone = excluded.phone, whatsapp = excluded.whatsapp,
  sort_order = excluded.sort_order;

------------------------------------------------------------------------------
-- Services (slugs match the live rohadent.com URLs)
------------------------------------------------------------------------------
insert into public.services (slug, name, summary, description, duration_minutes, sort_order) values
  ('scaling', 'Scaling (Teeth Cleaning)',
   'Professional removal of plaque and tartar for healthier gums and fresher breath.',
   'Ultrasonic scaling and polishing removes hardened tartar that brushing cannot reach, helping prevent gum disease and bad breath. Recommended every 6 months.',
   45, 1),
  ('teeth-whitening', 'Tooth Whitening',
   'Safe, dentist-supervised whitening for a noticeably brighter smile.',
   'In-clinic whitening lightens stains from coffee, tea and age in a single visit, with shade checks before and after and sensitivity care included.',
   60, 2),
  ('braces-invisible', 'Braces (Invisible / Clear Aligners)',
   'Straighten teeth discreetly with clear aligners or modern braces.',
   'Start with an orthodontic consultation: we examine your bite, take records and explain whether clear aligners or braces suit you best, with a full treatment plan and cost estimate.',
   45, 3),
  ('root-canal', 'Root Canal Treatment',
   'Relieve tooth pain and save your natural tooth.',
   'Modern rotary root canal treatment under local anaesthetic removes infection from inside the tooth and seals it, usually in one or two visits.',
   90, 4),
  ('emax-crown', 'E.max Crown',
   'Strong, natural-looking all-ceramic crowns for front and back teeth.',
   'E.max lithium disilicate crowns combine high strength with lifelike translucency — ideal for restoring broken, worn or root-canal-treated teeth.',
   60, 5),
  ('ceramic-crown', 'Ceramic Crown',
   'Durable tooth-coloured crowns to restore damaged teeth.',
   'Porcelain-fused ceramic crowns protect weakened teeth and restore their shape and function with a natural appearance.',
   60, 6),
  ('removable-denture', 'Removable Denture',
   'Comfortable partial or full dentures to replace missing teeth.',
   'Custom-made acrylic or flexible dentures restore chewing and your smile. Includes impressions, try-in and adjustments.',
   45, 7)
on conflict (slug) do update set
  name = excluded.name, summary = excluded.summary, description = excluded.description,
  duration_minutes = excluded.duration_minutes, sort_order = excluded.sort_order;

------------------------------------------------------------------------------
-- Dentists (PLACEHOLDER profiles)
------------------------------------------------------------------------------
insert into public.dentists (slug, full_name, title, bio, years_experience, sort_order) values
  ('dr-selam-bekele', 'Dr. Selam Bekele', 'General & Cosmetic Dentist',
   'Placeholder profile. Focuses on preventive care, whitening and smile makeovers.', 9, 1),
  ('dr-dawit-alemu', 'Dr. Dawit Alemu', 'Endodontist & Restorative Dentist',
   'Placeholder profile. Root canal treatment and crown restorations.', 12, 2),
  ('dr-meron-tadesse', 'Dr. Meron Tadesse', 'General Dentist',
   'Placeholder profile. Family dentistry, dentures and crowns.', 7, 3),
  ('dr-yonas-girma', 'Dr. Yonas Girma', 'Orthodontist',
   'Placeholder profile. Braces and clear aligners; visits both clinics.', 11, 4)
on conflict (slug) do update set
  full_name = excluded.full_name, title = excluded.title, bio = excluded.bio, sort_order = excluded.sort_order;

-- Which dentist performs which service
insert into public.dentist_services (dentist_id, service_id)
select d.id, s.id
from (values
  ('dr-selam-bekele',  array['scaling','teeth-whitening','ceramic-crown','emax-crown']),
  ('dr-dawit-alemu',   array['root-canal','emax-crown','ceramic-crown','scaling']),
  ('dr-meron-tadesse', array['scaling','teeth-whitening','root-canal','emax-crown','ceramic-crown','removable-denture']),
  ('dr-yonas-girma',   array['braces-invisible','scaling'])
) as m(dentist_slug, service_slugs)
join public.dentists d on d.slug = m.dentist_slug
join public.services s on s.slug = any (m.service_slugs)
on conflict do nothing;

------------------------------------------------------------------------------
-- Working hours: Mon–Sat 08:30–12:30 and 13:30–17:30 (lunch 12:30–13:30)
-- Dr. Yonas works Addis Mon–Wed and Gonder Thu–Sat.
------------------------------------------------------------------------------
delete from public.working_hours
where dentist_id in (select id from public.dentists
                     where slug in ('dr-selam-bekele','dr-dawit-alemu','dr-meron-tadesse','dr-yonas-girma'));

insert into public.working_hours (dentist_id, location_id, weekday, start_time, end_time)
select d.id, l.id, wd, blk.s, blk.e
from (values
  ('dr-selam-bekele',  'addis-ababa', array[1,2,3,4,5,6]),
  ('dr-dawit-alemu',   'addis-ababa', array[1,2,3,4,5,6]),
  ('dr-meron-tadesse', 'gonder',      array[1,2,3,4,5,6]),
  ('dr-yonas-girma',   'addis-ababa', array[1,2,3]),
  ('dr-yonas-girma',   'gonder',      array[4,5,6])
) as m(dentist_slug, location_slug, weekdays)
join public.dentists  d on d.slug = m.dentist_slug
join public.locations l on l.slug = m.location_slug
cross join lateral unnest(m.weekdays) as wd
cross join (values (time '08:30', time '12:30'), (time '13:30', time '17:30')) as blk(s, e);
