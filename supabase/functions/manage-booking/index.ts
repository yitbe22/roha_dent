// POST /functions/v1/manage-booking   { action: 'get' | 'cancel' | 'reschedule', token, ... }
// Public endpoint (verify_jwt = false). The 128-bit token in the patient's link is the credential.
import { manageRequestSchema } from '../_shared/schemas.ts';
import { clientIp, dbError, fail, json, preflight, readJson } from '../_shared/http.ts';
import { admin, allow } from '../_shared/db.ts';

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const body = await readJson(req);
  if (body === undefined) return fail(req, 400, 'INVALID_JSON');

  const parsed = manageRequestSchema.safeParse(body);
  if (!parsed.success) return fail(req, 400, 'VALIDATION');
  const input = parsed.data;

  const ip = clientIp(req);
  const limit = input.action === 'get' ? 60 : 10; // per 10 minutes per IP
  if (!(await allow(`manage:${input.action}:ip:${ip}`, limit, 600))) return fail(req, 429, 'RATE_LIMITED');

  const db = admin();

  if (input.action === 'get') {
    const { data, error } = await db.rpc('get_appointment_by_token', { p_token: input.token });
    if (error) return dbError(req, error);
    if (!data) return fail(req, 404, 'NOT_FOUND');
    return json(req, 200, { appointment: data });
  }

  if (input.action === 'cancel') {
    const { data, error } = await db.rpc('cancel_appointment_by_token', {
      p_token: input.token,
      p_reason: input.reason ?? null,
    });
    if (error) return dbError(req, error);
    // "booking cancelled" SMS is queued by the database trigger (migration 0008).
    return json(req, 200, { appointment: data });
  }

  const { data, error } = await db.rpc('reschedule_appointment_by_token', {
    p_token: input.token,
    p_starts_at: input.startsAt,
    p_dentist_id: input.dentistId ?? null,
  });
  if (error) return dbError(req, error);
  // "booking rescheduled" SMS is queued by the database trigger (migration 0008).
  return json(req, 200, { appointment: data });
});
