// SMS text helpers. Pure TS — shared by Edge Functions and the web app (template editor preview).
//
// One SMS = 160 GSM-7 characters (153 per part when split), or 70 UCS-2 characters (67 per part)
// as soon as the text contains anything outside GSM-7 — e.g. Amharic (Ge'ez script), emoji,
// curly quotes or an en dash. SMS Ethiopia bills per part.

const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€\f'; // each costs 2 septets

const basic = new Set(GSM_BASIC);
const extended = new Set(GSM_EXTENDED);

export type SmsEncoding = 'gsm7' | 'ucs2';
export type SmsInfo = {
  encoding: SmsEncoding;
  /** GSM septets or UTF-16 code units */
  units: number;
  segments: number;
  /** capacity of one part at this length (160/153 or 70/67) */
  perSegment: number;
  /** characters that forced UCS-2 (first few), for the template editor hint */
  nonGsm: string[];
};

export function smsInfo(text: string): SmsInfo {
  let septets = 0;
  const nonGsm: string[] = [];
  for (const ch of text) {
    if (basic.has(ch)) septets += 1;
    else if (extended.has(ch)) septets += 2;
    else if (nonGsm.length < 5 && !nonGsm.includes(ch)) nonGsm.push(ch);
    else if (nonGsm.length >= 5) break;
  }
  if (nonGsm.length === 0) {
    const segments = septets === 0 ? 0 : septets <= 160 ? 1 : Math.ceil(septets / 153);
    return { encoding: 'gsm7', units: septets, segments, perSegment: segments > 1 ? 153 : 160, nonGsm };
  }
  const units = text.length; // UTF-16 code units (emoji count as 2)
  const segments = units === 0 ? 0 : units <= 70 ? 1 : Math.ceil(units / 67);
  return { encoding: 'ucs2', units, segments, perSegment: segments > 1 ? 67 : 70, nonGsm };
}

/** Same rules as SQL public.render_sms_template: {key} → value; unknown placeholders are left as-is. */
export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return body.replace(/\{([a-z_]+)\}/g, (m, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? '') : m,
  );
}

export const TEMPLATE_PLACEHOLDERS = [
  'patient_name', 'patient_full_name', 'date', 'time', 'service', 'location', 'dentist', 'location_phone', 'manage_link',
  'patient_phone', 'status', 'local_time', 'local_date',
] as const;
export type TemplateVar = (typeof TEMPLATE_PLACEHOLDERS)[number];

/** Sample values for previews (typical lengths). */
export const SAMPLE_VARS: Record<TemplateVar, string> = {
  patient_name: 'Abebe',
  patient_full_name: 'Abebe Kebede',
  date: 'Tue 10 Nov',
  time: '09:30',
  service: 'Scaling (Teeth Cleaning)',
  location: 'Addis Ababa',
  dentist: 'Dr. Selam Bekele',
  location_phone: '+251 94 604 0506',
  manage_link: 'rohadent.com/b/3k9QzR7xWm2pL5vN8bY4tH',
  patient_phone: '+251911234567',
  status: 'pending',
  local_time: '3:30 ጠዋት',
  local_date: 'ኅዳር 1',
};

/** Longest realistic values — every default template must still fit in ONE SMS with these. */
export const WORST_CASE_VARS: Record<TemplateVar, string> = {
  patient_name: 'Gebremeskel',
  patient_full_name: 'Gebremeskel Woldemariam',
  date: 'Wed 30 Sep',
  time: '16:45',
  service: 'Braces (Invisible / Clear Aligners)',
  location: 'Addis Ababa',
  dentist: 'Dr. Selam Bekele',
  location_phone: '+251 94 604 0506',
  manage_link: 'rohadent.com/b/AbCdEfGhIjKlMnOpQrStUv',
  patient_phone: '+251911234567',
  status: 'confirmed',
  local_time: '10:45 ከሰዓት',
  local_date: 'መስከረም 20',
};

/**
 * Default English texts (also installed by migration 0010). Written to fit in one SMS (160 plain
 * characters): no Amharic letters, curly quotes or dashes, and a short manage link.
 */
export const DEFAULT_TEMPLATES: Record<string, string> = {
  booking_confirmed: 'Roha Dental {location}: {patient_name}, confirmed: {service}, {date} {time}. Change/cancel: {manage_link}',
  booking_cancelled: 'Roha Dental: your appointment {date} {time} is cancelled. To book again call {location_phone} or rohadent.com/book',
  booking_rescheduled: 'Roha Dental {location}: your appointment is moved to {date} {time}. Details: {manage_link}',
  clinic_new_booking: 'New booking: {patient_full_name} {patient_phone}, {service}, {date} {time}, {location}, {dentist}',
};
