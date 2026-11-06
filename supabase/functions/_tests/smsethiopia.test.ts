// deno test (from supabase/functions/_tests):  npx deno test --allow-env
import { assertEquals, assertObjectMatch } from '@std/assert';
import {
  getMessageStatus, mapProviderStatus, parseProviderError, sendSms, type ProviderConfig,
} from '../_shared/providers/smsethiopia.ts';

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

function fakeFetch(status: number, body: unknown, calls: Call[] = []): typeof fetch {
  return ((url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method ?? 'GET',
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    return Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
  }) as unknown as typeof fetch;
}

const cfg = (f: typeof fetch): ProviderConfig => ({ apiKey: 'TESTKEY0000', baseUrl: 'https://smsethiopia.com/', fetch: f });

Deno.test('send: posts v2 request with KEY header and msisdn/text body', async () => {
  const calls: Call[] = [];
  const r = await sendSms(
    cfg(fakeFetch(200, { sent: true, id: '01JZX5M8Q3T5V0X8YW9RCB2K7D', description: 'Accepted for delivery', segments: 2, status: 'ACCEPTED' }, calls)),
    '251911234567',
    'Hello',
  );
  assertEquals(r, { ok: true, messageId: '01JZX5M8Q3T5V0X8YW9RCB2K7D', status: 'accepted', segments: 2 });
  assertEquals(calls[0].url, 'https://smsethiopia.com/api/v2/sms/send');
  assertEquals(calls[0].method, 'POST');
  assertEquals(calls[0].headers.KEY, 'TESTKEY0000');
  assertEquals(calls[0].body, { msisdn: '251911234567', text: 'Hello' });
});

Deno.test('send: business error code is parsed and not retryable', async () => {
  const r = await sendSms(
    cfg(fakeFetch(400, { error_message: "You don't have enough package to send sms please contact with system Administrator. Error Code :: 10005" })),
    '251911234567', 'x',
  );
  assertObjectMatch(r, { ok: false, retryable: false, code: '10005', httpStatus: 400 });
});

Deno.test('send: field validation error', async () => {
  const r = await sendSms(cfg(fakeFetch(400, { msisdn: 'msisdn is mandatory' })), '', 'x');
  assertObjectMatch(r, { ok: false, retryable: false, code: 'VALIDATION', message: 'msisdn: msisdn is mandatory' });
});

Deno.test('send: 401 is a config error, 429 and 5xx are retryable', async () => {
  assertObjectMatch(await sendSms(cfg(fakeFetch(401, {})), '251911234567', 'x'), { ok: false, code: 'AUTH', retryable: false });
  assertObjectMatch(await sendSms(cfg(fakeFetch(429, {})), '251911234567', 'x'), { ok: false, code: 'RATE_LIMITED', retryable: true });
  assertObjectMatch(await sendSms(cfg(fakeFetch(503, 'upstream down')), '251911234567', 'x'), { ok: false, code: 'SERVER', retryable: true });
});

Deno.test('send: network failure is retryable', async () => {
  const failing = (() => Promise.reject(new TypeError('connection reset'))) as unknown as typeof fetch;
  assertObjectMatch(await sendSms(cfg(failing), '251911234567', 'x'), { ok: false, code: 'NETWORK', retryable: true });
});

Deno.test('send: 200 without sent=true is treated as failure', async () => {
  assertObjectMatch(await sendSms(cfg(fakeFetch(200, { sent: false, description: 'nope' })), '251911234567', 'x'),
    { ok: false, code: 'NOT_SENT', retryable: false });
});

Deno.test('status: GET v2 status by id', async () => {
  const calls: Call[] = [];
  const r = await getMessageStatus(
    cfg(fakeFetch(200, { id: 'ABC', resourceId: 1042, msisdn: '251911639555', segments: 1, status: 'DELIVERED' }, calls)),
    'ABC',
  );
  assertEquals(r, { ok: true, status: 'delivered', segments: 1 });
  assertEquals(calls[0].url, 'https://smsethiopia.com/api/v2/sms/ABC');
  assertEquals(calls[0].method, 'GET');
});

Deno.test('status mapping covers every documented status', () => {
  assertEquals(
    ['PENDING', 'ACCEPTED', 'SENT', 'DELIVERED', 'UNDELIVERED', 'FAILED', 'REJECTED', 'EXPIRED', 'weird', undefined].map(mapProviderStatus),
    ['accepted', 'accepted', 'sent', 'delivered', 'undelivered', 'failed', 'rejected', 'expired', 'accepted', 'accepted'],
  );
});

Deno.test('parseProviderError: unknown code keeps provider message', () => {
  assertObjectMatch(parseProviderError(400, { error_message: 'Something new. Error Code :: 19999' }),
    { code: '19999', message: 'Something new. Error Code :: 19999' });
});
