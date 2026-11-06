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

// ---- Ethiopian local time & calendar ------------------------------------------------------
// Local (Ethiopian) clock: the day starts at 6:00 → "12:00 in the morning"; 08:30 → "2:30 ጠዋት".

export type EthPeriod = 'night' | 'morning' | 'afternoon' | 'evening';
export const ETH_PERIOD_AM: Record<EthPeriod, string> = { night: 'ሌሊት', morning: 'ጠዋት', afternoon: 'ከሰዓት', evening: 'ምሽት' };

/** Ethiopian local clock for an instant, e.g. "2:30 ጠዋት" (lang 'am') or "2:30 morning" (lang 'en'). */
export function ethiopianTime(at: Date | string, lang: 'am' | 'en' = 'am'): string {
  const p = parts(new Date(at), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return ethiopianClock(Number(p.hour), p.minute, lang);
}

/** Same, from a clinic wall-clock "HH:MM". */
export function ethiopianTimeOfDay(hhmm: string, lang: 'am' | 'en' = 'am'): string {
  return ethiopianClock(Number(hhmm.slice(0, 2)), hhmm.slice(3, 5), lang);
}

function ethiopianClock(h24: number, mm: string, lang: 'am' | 'en'): string {
  const h = (h24 + 6) % 12 || 12;
  const period: EthPeriod = h24 < 6 ? 'night' : h24 < 12 ? 'morning' : h24 < 18 ? 'afternoon' : 'evening';
  return `${h}:${mm} ${lang === 'am' ? ETH_PERIOD_AM[period] : period}`;
}

export const ETH_MONTHS_AM = ['መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'];
export const ETH_MONTHS_EN = ['Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'];

const ETH_EPOCH_JDN = 1723856; // Amete Mihret

/** Gregorian YYYY-MM-DD (clinic date key) → Ethiopian calendar date. */
export function toEthiopianDate(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split('-').map(Number);
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  const r = (jdn - ETH_EPOCH_JDN) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return {
    year: 4 * Math.floor((jdn - ETH_EPOCH_JDN) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: (n % 30) + 1,
  };
}

/** e.g. "ጥቅምት 27, 2019" (am) or "Tikimt 27, 2019" (en). Accepts a date key or an instant. */
export function formatEthiopianDate(at: Date | string, lang: 'am' | 'en' = 'am', withYear = true): string {
  const key = typeof at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : clinicDateKey(at);
  const e = toEthiopianDate(key);
  const month = (lang === 'am' ? ETH_MONTHS_AM : ETH_MONTHS_EN)[e.month - 1];
  return withYear ? `${month} ${e.day}, ${e.year}` : `${month} ${e.day}`;
}
