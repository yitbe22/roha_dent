// Ethiopian mobile number normalization. Pure TS — shared by Edge Functions (Deno) and the web app.
//
// SMS Ethiopia only delivers to Ethio Telecom numbers (msisdn 2519XXXXXXXX), so for now only
// 09… numbers are accepted. Safaricom (07…) numbers are recognised and rejected with a clear reason.

export type PhoneError = 'EMPTY' | 'INVALID' | 'UNSUPPORTED_NETWORK';
export type PhoneResult = { ok: true; e164: string } | { ok: false; error: PhoneError };

/**
 * Accepts 0911234567, 911234567, 251911234567, +251911234567, 00251911234567,
 * with spaces, dashes, dots or brackets. Returns +2519XXXXXXXX.
 */
export function normalizeEthiopianPhone(input: string | null | undefined): PhoneResult {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: false, error: 'EMPTY' };

  let s = raw.replace(/[\s\-(). ]/g, '');
  if (!/^\+?\d+$/.test(s)) return { ok: false, error: 'INVALID' };
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);

  let national = s.startsWith('251') ? s.slice(3) : s;
  // Trunk zero: 0911… or the common mistake +2510911…
  if (national.length === 10 && national.startsWith('0')) national = national.slice(1);

  if (!/^[79]\d{8}$/.test(national)) return { ok: false, error: 'INVALID' };
  if (national.startsWith('7')) return { ok: false, error: 'UNSUPPORTED_NETWORK' };
  return { ok: true, e164: `+251${national}` };
}

/** SMS Ethiopia expects 12 digits without "+": 2519XXXXXXXX */
export const toMsisdn = (e164: string) => e164.replace(/^\+/, '');

/** +251911234567 → +251 91 123 4567 */
export function formatEthiopianPhone(e164: string): string {
  const m = /^\+251(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+251 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
