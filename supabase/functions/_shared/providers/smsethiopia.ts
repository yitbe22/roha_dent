// SMS Ethiopia adapter — the ONLY file that knows the provider's API.
// Docs: https://smsethiopia.com/#/landing/docs/api-v1  (v2 endpoints, same key and body as v1)
//
//   POST {base}/api/v2/sms/send     headers: KEY: <api key>     body: {"msisdn":"2519XXXXXXXX","text":"..."}
//        → 200 {"sent":true,"id":"01JZ…","description":"Accepted for delivery","segments":1,"status":"ACCEPTED"}
//   GET  {base}/api/v2/sms/{id}     → {"id","msisdn","segments","status":"DELIVERED","createdAt"}
//   Errors: 400 {"error_message":"… Error Code :: 10005"} | 400 {"msisdn":"msisdn is mandatory"} | 401 | 404 | 429 | 5xx
//   Statuses: PENDING ACCEPTED SENT DELIVERED UNDELIVERED FAILED REJECTED EXPIRED
//   The sender ID is NOT in the payload: it belongs to the campaign the API key is bound to.

export type ProviderConfig = {
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
  fetch?: typeof fetch; // injectable for tests
};

export type DeliveryStatus = 'accepted' | 'sent' | 'delivered' | 'undelivered' | 'failed' | 'rejected' | 'expired';

export type ProviderFailure = {
  ok: false;
  retryable: boolean;
  /** Provider business code ("10005") or one of: VALIDATION AUTH NOT_FOUND RATE_LIMITED SERVER NETWORK NOT_SENT BAD_RESPONSE */
  code: string;
  message: string;
  httpStatus: number | null;
};
export type SendSuccess = { ok: true; messageId: string; status: DeliveryStatus; segments: number | null };
export type StatusSuccess = { ok: true; status: DeliveryStatus; segments: number | null };

export const PROVIDER_ERRORS: Record<string, string> = {
  '10000': 'Invalid phone number (must be 2519XXXXXXXX)',
  '10002': 'SMS Ethiopia campaign is not activated',
  '10005': 'SMS balance is empty — top up the SMS Ethiopia campaign',
  '10006': 'Sender ID is not approved yet by Ethio Telecom',
  '10007': 'Number is not whitelisted on the free test campaign',
};

export function mapProviderStatus(s: unknown): DeliveryStatus {
  switch (String(s ?? '').toUpperCase()) {
    case 'SENT': return 'sent';
    case 'DELIVERED': return 'delivered';
    case 'UNDELIVERED': return 'undelivered';
    case 'FAILED': return 'failed';
    case 'REJECTED': return 'rejected';
    case 'EXPIRED': return 'expired';
    default: return 'accepted'; // PENDING, ACCEPTED, unknown
  }
}

export function isFinalStatus(s: DeliveryStatus): boolean {
  return s !== 'accepted' && s !== 'sent';
}

export function parseProviderError(httpStatus: number, body: unknown): ProviderFailure {
  const b = (body ?? {}) as Record<string, unknown>;
  if (httpStatus === 400) {
    const msg = typeof b.error_message === 'string' ? b.error_message : undefined;
    const code = msg?.match(/Error\s*Code\s*:+\s*(\d+)/i)?.[1];
    if (code) return { ok: false, retryable: false, code, message: PROVIDER_ERRORS[code] ?? msg!, httpStatus };
    const fields = Object.entries(b).filter(([, v]) => typeof v === 'string').map(([k, v]) => `${k}: ${v}`);
    return { ok: false, retryable: false, code: 'VALIDATION', message: msg ?? (fields.join('; ') || 'Bad request'), httpStatus };
  }
  if (httpStatus === 401 || httpStatus === 403)
    return { ok: false, retryable: false, code: 'AUTH', message: 'API key missing, invalid or deactivated', httpStatus };
  if (httpStatus === 404) return { ok: false, retryable: false, code: 'NOT_FOUND', message: 'Not found', httpStatus };
  if (httpStatus === 429) return { ok: false, retryable: true, code: 'RATE_LIMITED', message: 'Provider rate limit', httpStatus };
  return { ok: false, retryable: httpStatus >= 500, code: 'SERVER', message: `Provider HTTP ${httpStatus}`, httpStatus };
}

async function call(cfg: ProviderConfig, path: string, init: RequestInit): Promise<{ status: number; body: unknown } | ProviderFailure> {
  const f = cfg.fetch ?? fetch;
  try {
    const res = await f(`${cfg.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: { KEY: cfg.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: AbortSignal.timeout(cfg.timeoutMs ?? 15_000),
    });
    const text = await res.text();
    let body: unknown;
    try { body = text ? JSON.parse(text) : undefined; } catch { body = { raw: text.slice(0, 300) }; }
    return { status: res.status, body };
  } catch (e) {
    return { ok: false, retryable: true, code: 'NETWORK', message: e instanceof Error ? e.message : String(e), httpStatus: null };
  }
}

/** msisdn: 12 digits, 2519XXXXXXXX (use toMsisdn() from phone.ts). */
export async function sendSms(cfg: ProviderConfig, msisdn: string, text: string): Promise<SendSuccess | ProviderFailure> {
  const r = await call(cfg, '/api/v2/sms/send', { method: 'POST', body: JSON.stringify({ msisdn, text }) });
  if ('ok' in r) return r;
  if (r.status < 200 || r.status >= 300) return parseProviderError(r.status, r.body);
  const b = (r.body ?? {}) as Record<string, unknown>;
  if (b.sent !== true || b.id === undefined || b.id === null) {
    return { ok: false, retryable: false, code: 'NOT_SENT', message: String(b.description ?? 'Provider did not accept the message'), httpStatus: r.status };
  }
  return {
    ok: true,
    messageId: String(b.id),
    status: mapProviderStatus(b.status),
    segments: typeof b.segments === 'number' ? b.segments : null,
  };
}

export async function getMessageStatus(cfg: ProviderConfig, messageId: string): Promise<StatusSuccess | ProviderFailure> {
  const r = await call(cfg, `/api/v2/sms/${encodeURIComponent(messageId)}`, { method: 'GET' });
  if ('ok' in r) return r;
  if (r.status !== 200) return parseProviderError(r.status, r.body);
  const b = (r.body ?? {}) as Record<string, unknown>;
  if (typeof b.status !== 'string') return { ok: false, retryable: true, code: 'BAD_RESPONSE', message: 'No status in response', httpStatus: 200 };
  return { ok: true, status: mapProviderStatus(b.status), segments: typeof b.segments === 'number' ? b.segments : null };
}
