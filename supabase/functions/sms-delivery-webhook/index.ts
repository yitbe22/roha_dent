// POST /functions/v1/sms-delivery-webhook?secret=<SMS_WEBHOOK_SECRET>
// SMS Ethiopia "delivery webhook" add-on: {"id":"01JZ…","msisdn":"2519…","status":"DELIVERED","timestamp":"…Z"}
// The provider does not sign webhooks, so the secret lives in the URL configured with their support.
// Without the add-on, send-sms polls statuses instead — this endpoint is optional.
import { admin } from '../_shared/db.ts';
import { isFinalStatus, mapProviderStatus } from '../_shared/providers/smsethiopia.ts';

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'method not allowed' });
  const secret = Deno.env.get('SMS_WEBHOOK_SECRET');
  if (!secret || new URL(req.url).searchParams.get('secret') !== secret) return reply(401, { error: 'unauthorized' });

  let payload: { id?: unknown; status?: unknown; timestamp?: unknown };
  try {
    payload = await req.json();
  } catch {
    return reply(400, { error: 'invalid json' });
  }
  const id = typeof payload.id === 'string' || typeof payload.id === 'number' ? String(payload.id) : '';
  if (!id || id.length > 64) return reply(400, { error: 'missing id' });

  const status = mapProviderStatus(payload.status);
  const at = typeof payload.timestamp === 'string' && !Number.isNaN(Date.parse(payload.timestamp))
    ? new Date(payload.timestamp).toISOString()
    : new Date().toISOString();

  const { error, count } = await admin()
    .from('sms_log')
    .update(
      { status, last_checked_at: new Date().toISOString(), ...(status === 'delivered' ? { delivered_at: at } : isFinalStatus(status) ? { error: `Delivery ${status}` } : {}) },
      { count: 'exact' },
    )
    .eq('provider_message_id', id);
  if (error) {
    console.error('webhook update failed', error);
    return reply(500, { error: 'update failed' });
  }
  // 200 even when unknown (count 0) so the provider does not retry forever.
  return reply(200, { ok: true, matched: count ?? 0 });
});
