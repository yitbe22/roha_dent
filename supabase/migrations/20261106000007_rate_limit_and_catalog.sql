-- 0007 — Rate limiting (Edge Functions) and the public booking catalog

------------------------------------------------------------------------------
-- Fixed-window rate limiter. Returns true when the request is allowed.
-- Called by Edge Functions with keys like 'book:ip:1.2.3.4' or 'book:phone:+2519…'.
------------------------------------------------------------------------------
create or replace function public.hit_rate_limit(p_bucket text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits   int;
begin
  insert into public.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return v_hits <= p_max;
end;
$$;

create or replace function public.purge_rate_limits()
returns int
language sql
volatile
security definer
set search_path = ''
as $$
  with d as (delete from public.rate_limits where window_start < now() - interval '2 days' returning 1)
  select count(*)::int from d;
$$;

revoke execute on function public.hit_rate_limit(text, int, int), public.purge_rate_limits() from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int), public.purge_rate_limits() to service_role;

------------------------------------------------------------------------------
-- Everything the booking wizard needs, in one round trip (mobile networks).
------------------------------------------------------------------------------
create or replace function public.get_booking_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'slug', l.slug, 'name', l.name, 'city', l.city, 'phone', l.phone)
                       order by l.sort_order)
      from public.locations l where l.is_active), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name,
                                          'summary', s.summary, 'duration_minutes', s.duration_minutes)
                       order by s.sort_order)
      from public.services s where s.is_active and s.is_bookable), '[]'::jsonb),
    'dentists', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'slug', d.slug, 'full_name', d.full_name, 'title', d.title,
               'service_ids', coalesce((select jsonb_agg(ds.service_id) from public.dentist_services ds
                                        where ds.dentist_id = d.id), '[]'::jsonb),
               'location_ids', coalesce((select jsonb_agg(distinct wh.location_id) from public.working_hours wh
                                         join public.locations l on l.id = wh.location_id and l.is_active
                                         where wh.dentist_id = d.id), '[]'::jsonb))
             order by d.sort_order)
      from public.dentists d where d.is_active and d.accepts_online_booking), '[]'::jsonb),
    'settings', (select jsonb_build_object('max_advance_days', s.max_advance_days,
                                           'min_lead_minutes', s.min_lead_minutes,
                                           'cancel_cutoff_minutes', s.cancel_cutoff_minutes)
                 from public.settings s where s.id)
  );
$$;

grant execute on function public.get_booking_catalog() to anon, authenticated;
