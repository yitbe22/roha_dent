// Clinic-time helpers and slot grouping. Pure TS — shared by Edge Functions and the web app.
// Slots themselves are computed in Postgres (public._available_slots); these helpers present them.

export const CLINIC_TZ = 'Africa/Addis_Ababa';

export type SlotRow = { dentist_id: string; starts_at: string; ends_at: string };
export type TimeOption = { startsAt: string; endsAt: string; dentistIds: string[] };
export type PartOfDay = 'morning' | 'afternoon' | 'evening';

const parts = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: CLINIC_TZ, ...opts }).formatToParts(d).map((p) => [p.type, p.value]),
  );

/** Calendar date in the clinic's timezone, as YYYY-MM-DD. */
export function clinicDateKey(at: Date | string = new Date()): string {
  const p = parts(new Date(at), { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hour (0–23) on the clinic's wall clock. */
export function clinicHour(at: Date | string): number {
  return Number(parts(new Date(at), { hour: '2-digit', hourCycle: 'h23' }).hour);
}

/** Pure calendar arithmetic on a YYYY-MM-DD key. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday (matches Postgres extract(dow)). */
export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function partOfDay(at: Date | string): PartOfDay {
  const h = clinicHour(at);
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

/** 24-hour clinic time, e.g. "09:30" (unambiguous vs. Ethiopian 12-hour local time). */
export function formatClinicTime(at: Date | string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { timeZone: CLINIC_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(at));
}

/** e.g. "Monday, 10 November 2026" */
export function formatClinicDate(at: Date | string, locale = 'en-GB', withYear = true): string {
  const d = typeof at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(at) ? new Date(`${at}T12:00:00+03:00`) : new Date(at);
  return new Intl.DateTimeFormat(locale, {
    timeZone: CLINIC_TZ, weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}),
  }).format(d);
}

/**
 * Collapse per-dentist slot rows into unique start times (for "any available dentist"),
 * sorted, each listing which dentists are free.
 */
export function groupSlots(rows: SlotRow[]): TimeOption[] {
  const byStart = new Map<number, TimeOption>();
  for (const r of rows) {
    const t = new Date(r.starts_at).getTime();
    if (Number.isNaN(t)) continue;
    const existing = byStart.get(t);
    if (existing) {
      if (!existing.dentistIds.includes(r.dentist_id)) existing.dentistIds.push(r.dentist_id);
    } else {
      byStart.set(t, {
        startsAt: new Date(t).toISOString(),
        endsAt: new Date(r.ends_at).toISOString(),
        dentistIds: [r.dentist_id],
      });
    }
  }
  return [...byStart.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

export function splitByPartOfDay(options: TimeOption[]): Record<PartOfDay, TimeOption[]> {
  const out: Record<PartOfDay, TimeOption[]> = { morning: [], afternoon: [], evening: [] };
  for (const o of options) out[partOfDay(o.startsAt)].push(o);
  return out;
}

/** Ethiopia is UTC+3 all year (no DST), so clinic wall-clock ↔ instant is a fixed offset. */
const CLINIC_OFFSET = '+03:00';

/** Clinic wall-clock date + "HH:MM" → ISO instant (UTC). */
export function clinicIso(dateKey: string, hhmm: string): string {
  return new Date(`${dateKey}T${hhmm.slice(0, 5)}:00${CLINIC_OFFSET}`).toISOString();
}

/** [from, to) instants covering one clinic calendar day. */
export function clinicDayRange(dateKey: string): { from: string; to: string } {
  return { from: clinicIso(dateKey, '00:00'), to: clinicIso(addDays(dateKey, 1), '00:00') };
}

/** Minutes between two instants. */
export function minutesBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
}
