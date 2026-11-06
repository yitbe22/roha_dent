// Cloudflare Turnstile server-side verification. Fails closed.
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not set — rejecting');
    return false;
  }
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip && ip !== 'unknown') form.append('remoteip', ip);
  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(8000) });
    const body = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (!body.success) console.warn('turnstile rejected', body['error-codes']);
    return body.success === true;
  } catch (e) {
    console.error('turnstile verify failed', e);
    return false;
  }
}
