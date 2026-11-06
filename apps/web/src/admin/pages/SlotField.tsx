import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatClinicTime, splitByPartOfDay, groupSlots } from '@shared/time.ts';
import { supabase } from '../supabase';
import { Field, inputInline } from '../ui';

type Props = {
  locationId: string;
  serviceId: string;
  dentistId: string;
  date: string;
  /** "HH:MM" clinic time */
  time: string;
  onTime: (t: string) => void;
  /** start ISO to hide (the appointment being moved) */
  excludeStart?: string;
};

const PART_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' } as const;

/**
 * Free start times for one dentist (from working hours, days off and other bookings), plus an
 * "other time" box so staff can squeeze a patient in. The database still refuses anything that
 * overlaps another booking of the same dentist.
 */
export function SlotField(p: Props) {
  const [manual, setManual] = useState(false);
  const slots = useQuery({
    queryKey: ['admin-slots', p.locationId, p.serviceId, p.dentistId, p.date],
    enabled: Boolean(p.locationId && p.serviceId && p.dentistId && p.date),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_available_slots', {
        p_location_id: p.locationId, p_service_id: p.serviceId, p_date: p.date, p_dentist_id: p.dentistId,
      });
      if (error) throw error;
      return groupSlots(data as { dentist_id: string; starts_at: string; ends_at: string }[]).filter((o) => o.startsAt !== p.excludeStart);
    },
  });
  const groups = splitByPartOfDay(slots.data ?? []);
  const isSlot = (slots.data ?? []).some((o) => formatClinicTime(o.startsAt) === p.time);

  return (
    <div className="space-y-4">
      {!p.dentistId ? (
        <p className="text-ink-soft">Choose the dentist first — then the free times appear here.</p>
      ) : slots.isPending ? (
        <p className="text-ink-soft">Looking for free times…</p>
      ) : slots.isError ? (
        <p className="text-red-700">Could not load the free times. Type the time below instead.</p>
      ) : slots.data.length === 0 ? (
        <p className="rounded-lg bg-enamel px-3 py-2 text-ink-soft">
          No free times left this day for this dentist. Pick another day, or type a time below if you want to squeeze the patient in.
        </p>
      ) : (
        (['morning', 'afternoon', 'evening'] as const).map((part) =>
          groups[part].length ? (
            <div key={part}>
              <p className="mb-1.5 text-sm font-semibold text-ink-soft">{PART_LABEL[part]}</p>
              <div className="flex flex-wrap gap-2">
                {groups[part].map((o) => {
                  const t = formatClinicTime(o.startsAt);
                  const on = p.time === t;
                  return (
                    <button key={o.startsAt} type="button" aria-pressed={on} onClick={() => { setManual(false); p.onTime(t); }}
                      className={`min-h-11 min-w-20 rounded-lg border-2 px-3 text-base font-bold tabular-nums transition-colors ${
                        on ? 'border-roha-700 bg-roha-700 text-white' : 'border-line bg-white text-roha-800 hover:border-roha-500'
                      }`}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null,
        )
      )}

      {manual || (p.time && !isSlot) ? (
        <Field label="Other time" hint="Clinic time, 24-hour clock (e.g. 14:30). The system checks the dentist is free.">
          <input type="time" step={300} className={`${inputInline} w-40`} value={p.time} onChange={(e) => p.onTime(e.target.value)} autoFocus={manual} />
        </Field>
      ) : (
        p.dentistId && (
          <button type="button" className="link text-sm" onClick={() => setManual(true)}>Need a different time? Type it yourself</button>
        )
      )}
    </div>
  );
}
