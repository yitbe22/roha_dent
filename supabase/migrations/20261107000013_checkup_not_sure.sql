-- "Not sure yet": a bookable check-up for patients who don't know which treatment they need.
-- Every dentist offers it (existing ones now, new ones automatically), so any free time can be booked.
-- Staff can change the treatment after the examination.

insert into public.services (slug, name, summary, description, duration_minutes, sort_order)
values ('checkup', 'Check-up (not sure yet)',
        'An examination for patients who are not sure which treatment they need.',
        'The dentist examines your teeth, explains what is needed and your options, and gives you a cost estimate before any treatment starts.',
        30, 0)
on conflict (slug) do nothing;

insert into public.dentist_services (dentist_id, service_id)
select d.id, s.id from public.dentists d cross join public.services s
where s.slug = 'checkup'
on conflict do nothing;

create or replace function public.dentist_offers_checkup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.dentist_services (dentist_id, service_id)
  select new.id, s.id from public.services s where s.slug = 'checkup'
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists dentists_offer_checkup on public.dentists;
create trigger dentists_offer_checkup
  after insert on public.dentists
  for each row execute function public.dentist_offers_checkup();
