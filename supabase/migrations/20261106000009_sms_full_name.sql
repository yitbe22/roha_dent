-- 0009 — {patient_full_name} placeholder; clinic alerts show the full name.

create or replace function public._enqueue_appointment_sms(p_appointment_id uuid, p_type public.sms_type)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cfg        public.settings;
  v          record;
  v_template   text;
  v_recipients text[];
  v_body       text;
  v_status     public.sms_status;
  v_error      text;
  v_to         text;
  v_count      int := 0;
begin
  select * into v_cfg from public.settings s where s.id;

  select a.id, a.status, a.starts_at, a.location_id,
         p.full_name, p.phone as patient_phone,
         l.city, l.phone as location_phone, l.alert_phone,
         d.full_name as dentist_name, s.name as service_name,
         sec.manage_token
    into v
  from public.appointments a
  join public.patients  p on p.id = a.patient_id
  join public.locations l on l.id = a.location_id
  join public.dentists  d on d.id = a.dentist_id
  join public.services  s on s.id = a.service_id
  left join public.appointment_secrets sec on sec.appointment_id = a.id
  where a.id = p_appointment_id;
  if not found then return 0; end if;

  select t.body into v_template
  from public.sms_templates t
  where t.key = p_type and t.locale = 'en' and t.is_active;

  if p_type = 'clinic_new_booking' then
    select coalesce(array_agg(distinct x), '{}') into v_recipients
    from unnest(array_remove(array[v.alert_phone], null) || v_cfg.owner_alert_phones) as x
    where x ~ '^\+2519[0-9]{8}$';
  else
    v_recipients := array[v.patient_phone];
  end if;
  if coalesce(array_length(v_recipients, 1), 0) = 0 then return 0; end if;

  v_body := public.render_sms_template(coalesce(v_template, ''), jsonb_build_object(
    'patient_name',   split_part(v.full_name, ' ', 1),
    'patient_full_name', v.full_name,
    'patient_phone',  v.patient_phone,
    'date',           to_char(v.starts_at at time zone public.clinic_tz(), 'Dy FMDD Mon'),
    'time',           to_char(v.starts_at at time zone public.clinic_tz(), 'HH24:MI'),
    'service',        v.service_name,
    'location',       v.city,
    'location_phone', v.location_phone,
    'dentist',        v.dentist_name,
    'status',         v.status,
    'manage_link',    case when v.manage_token is null then v_cfg.public_site_url
                           else rtrim(v_cfg.public_site_url, '/') || '/booking/' || v.manage_token end
  ));

  v_status := case when not v_cfg.sms_enabled or v_template is null then 'skipped' else 'queued' end;
  v_error  := case when not v_cfg.sms_enabled then 'SMS is turned off in settings'
                   when v_template is null then 'Template "' || p_type || '" is disabled' end;

  foreach v_to in array v_recipients loop
    insert into public.sms_log (appointment_id, location_id, type, to_phone, body, status, error)
    values (v.id, v.location_id, p_type, v_to, coalesce(nullif(v_body, ''), '(empty template)'), v_status, v_error);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

update public.sms_templates
   set body = 'New booking ({status}): {patient_full_name} {patient_phone}, {service}, {date} {time}, {location}, {dentist}'
 where key = 'clinic_new_booking' and locale = 'en'
   and body = 'New booking ({status}): {patient_name} {patient_phone}, {service}, {date} {time}, {location}, {dentist}';
