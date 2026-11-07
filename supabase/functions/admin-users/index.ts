// POST /functions/v1/admin-users   (owner only, except set_own_password — Authorization: Bearer <user access token>)
//   {action:"list"}                                       → staff with email + last sign-in
//   {action:"create", email, full_name, role, location_id, phone?}  → {id, tempPassword}
//   {action:"update", id, full_name?, role?, location_id?, phone?, is_active?}
//   {action:"reset_password", id}                         → {tempPassword}
//   {action:"set_own_password", password}   (any active staff member, for their own account) → {ok}
//
// Accounts get a temporary password the owner hands over in person; the user must change it at
// first sign-in. The flag lives in app_metadata.must_change_password, which only the service role
// can write, and it is cleared only here, together with the password change itself. No email is needed — Supabase's built-in
// mailer only delivers to project team members, so invite emails would not reach clinic staff.
//
// Profile rows are written with the OWNER's JWT (RLS + audit_log record the real actor);
// only auth.users operations use the service role.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { corsHeaders } from '../_shared/http.ts';
import { admin } from '../_shared/db.ts';
import { normalizeEthiopianPhone } from '../_shared/phone.ts';

const phone = z.string().trim().max(20).nullable().optional();
const role = z.enum(['owner', 'staff']);
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }),
  z.object({
    action: z.literal('create'),
    email: z.email().max(200).transform((s) => s.trim().toLowerCase()),
    full_name: z.string().trim().min(2).max(120),
    role,
    location_id: z.uuid().nullable(),
    phone,
  }),
  z.object({
    action: z.literal('update'),
    id: z.uuid(),
    full_name: z.string().trim().min(2).max(120).optional(),
    role: role.optional(),
    location_id: z.uuid().nullable().optional(),
    phone,
    is_active: z.boolean().optional(),
  }),
  z.object({ action: z.literal('reset_password'), id: z.uuid() }),
  z.object({ action: z.literal('set_own_password'), password: z.string().min(10).max(72) }),
]);

export const MIN_PASSWORD = 10;

type ErrorCode =
  | 'METHOD_NOT_ALLOWED' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION' | 'INVALID_PHONE' | 'EMAIL_TAKEN'
  | 'LOCATION_REQUIRED' | 'SELF_CHANGE' | 'NOT_FOUND' | 'WEAK_PASSWORD' | 'SERVER_ERROR';

const reply = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
const fail = (req: Request, status: number, code: ErrorCode, message?: string) =>
  reply(req, status, { error: { code, ...(message ? { message } : {}) } });

/** 12 chars from an unambiguous alphabet, grouped: "k7Rm-Qx4p-W9tz" (~70 bits). */
function tempPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

function normalizePhone(p: string | null | undefined): { ok: true; value: string | null } | { ok: false } {
  if (p === undefined || p === null || p.trim() === '') return { ok: true, value: null };
  const r = normalizeEthiopianPhone(p);
  return r.ok ? { ok: true, value: r.e164 } : { ok: false };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return fail(req, 405, 'METHOD_NOT_ALLOWED');

  // ---- caller must be an active staff member (and an owner for everything but their own password)
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return fail(req, 401, 'UNAUTHORIZED');
  const svc = admin();
  const { data: who, error: whoErr } = await svc.auth.getUser(jwt);
  if (whoErr || !who.user) return fail(req, 401, 'UNAUTHORIZED');
  const { data: me } = await svc.from('profiles').select('role, is_active').eq('id', who.user.id).maybeSingle();
  if (!me || !me.is_active) return fail(req, 403, 'FORBIDDEN');

  const asOwner: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(req, 400, 'VALIDATION', 'Invalid JSON');
  }
  if ((body as { action?: unknown } | null)?.action === 'set_own_password') {
    const pw = (body as { password?: unknown }).password;
    if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) return fail(req, 400, 'WEAK_PASSWORD', `Use at least ${MIN_PASSWORD} characters.`);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return fail(req, 400, 'VALIDATION', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const input = parsed.data;
  if (input.action !== 'set_own_password' && me.role !== 'owner') return fail(req, 403, 'FORBIDDEN');

  try {
    switch (input.action) {
      case 'list': {
        const [{ data: profiles, error }, users] = await Promise.all([
          asOwner.from('profiles').select('id, full_name, phone, role, location_id, is_active, created_at').order('full_name'),
          svc.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        ]);
        if (error) throw error;
        const byId = new Map((users.data?.users ?? []).map((u) => [u.id, u]));
        return reply(req, 200, {
          staff: (profiles ?? []).map((p) => {
            const u = byId.get(p.id);
            return {
              ...p,
              email: u?.email ?? null,
              last_sign_in_at: u?.last_sign_in_at ?? null,
              must_change_password: Boolean(u?.app_metadata?.must_change_password),
            };
          }),
        });
      }

      case 'create': {
        if (input.role === 'staff' && !input.location_id) return fail(req, 400, 'LOCATION_REQUIRED');
        const ph = normalizePhone(input.phone);
        if (!ph.ok) return fail(req, 400, 'INVALID_PHONE');
        const password = tempPassword();
        const { data: created, error } = await svc.auth.admin.createUser({
          email: input.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: input.full_name },
          app_metadata: { must_change_password: true },
        });
        if (error || !created.user) {
          if (/already|registered|exists/i.test(error?.message ?? '')) return fail(req, 409, 'EMAIL_TAKEN');
          throw error;
        }
        const { error: pErr } = await asOwner.from('profiles').insert({
          id: created.user.id,
          full_name: input.full_name,
          role: input.role,
          location_id: input.location_id,
          phone: ph.value,
        });
        if (pErr) {
          await svc.auth.admin.deleteUser(created.user.id); // keep auth.users and profiles in step
          throw pErr;
        }
        return reply(req, 201, { id: created.user.id, tempPassword: password });
      }

      case 'update': {
        if (input.id === who.user.id && (input.is_active === false || input.role === 'staff')) {
          return fail(req, 400, 'SELF_CHANGE', 'You cannot deactivate or demote your own account');
        }
        const patch: Record<string, unknown> = {};
        if (input.full_name !== undefined) patch.full_name = input.full_name;
        if (input.role !== undefined) patch.role = input.role;
        if (input.location_id !== undefined) patch.location_id = input.location_id;
        if (input.is_active !== undefined) patch.is_active = input.is_active;
        if (input.phone !== undefined) {
          const ph = normalizePhone(input.phone);
          if (!ph.ok) return fail(req, 400, 'INVALID_PHONE');
          patch.phone = ph.value;
        }
        if (Object.keys(patch).length) {
          const { data, error } = await asOwner.from('profiles').update(patch).eq('id', input.id).select('id, role, location_id');
          if (error) {
            if (error.code === '23514') return fail(req, 400, 'LOCATION_REQUIRED');
            throw error;
          }
          if (!data?.length) return fail(req, 404, 'NOT_FOUND');
        }
        if (input.is_active !== undefined) {
          // Deactivated users can't sign in at all (RLS already denies them data via is_active).
          const { error } = await svc.auth.admin.updateUserById(input.id, { ban_duration: input.is_active ? 'none' : '876000h' });
          if (error) throw error;
        }
        return reply(req, 200, { ok: true });
      }

      case 'reset_password': {
        const { data: target, error: gErr } = await svc.auth.admin.getUserById(input.id);
        if (gErr || !target.user) return fail(req, 404, 'NOT_FOUND');
        const password = tempPassword();
        const { error } = await svc.auth.admin.updateUserById(input.id, {
          password,
          app_metadata: { ...(target.user.app_metadata ?? {}), must_change_password: true },
        });
        if (error) throw error;
        return reply(req, 200, { tempPassword: password });
      }

      case 'set_own_password': {
        // The only way the "must change password" flag is cleared: together with a real new password.
        const { error } = await svc.auth.admin.updateUserById(who.user.id, {
          password: input.password,
          app_metadata: { ...(who.user.app_metadata ?? {}), must_change_password: false },
        });
        if (error) throw error;
        return reply(req, 200, { ok: true });
      }
    }
  } catch (e) {
    console.error('admin-users', input.action, e);
    return fail(req, 500, 'SERVER_ERROR');
  }
});
