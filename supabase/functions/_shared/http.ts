// HTTP helpers for Edge Functions (Deno).
import type { ApiErrorCode } from './schemas.ts';

function allowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = allowedOrigins();
  const allow = allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function fail(req: Request, status: number, code: ApiErrorCode, details?: unknown): Response {
  return json(req, status, { error: { code, ...(details === undefined ? {} : { details }) } });
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return fail(req, 405, 'METHOD_NOT_ALLOWED');
  return null;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function readJson(req: Request): Promise<unknown | undefined> {
  try {
    const text = await req.text();
    if (text.length > 10_000) return undefined;
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Business errors raised by our SQL functions (SQLSTATE P0001, message = code). */
const DB_ERRORS: Partial<Record<string, { status: number; code: ApiErrorCode }>> = {
  INVALID_PHONE: { status: 400, code: 'INVALID_PHONE' },
  INVALID_NAME: { status: 400, code: 'INVALID_NAME' },
  INVALID_NOTES: { status: 400, code: 'INVALID_NOTES' },
  SLOT_UNAVAILABLE: { status: 409, code: 'SLOT_UNAVAILABLE' },
  TOO_MANY_ACTIVE_BOOKINGS: { status: 409, code: 'TOO_MANY_ACTIVE_BOOKINGS' },
  NOT_FOUND: { status: 404, code: 'NOT_FOUND' },
  CANNOT_CANCEL: { status: 409, code: 'CANNOT_CANCEL' },
  CANNOT_RESCHEDULE: { status: 409, code: 'CANNOT_RESCHEDULE' },
};

export function dbError(req: Request, err: { code?: string; message?: string }): Response {
  const mapped = err.code === 'P0001' && err.message ? DB_ERRORS[err.message] : undefined;
  if (mapped) return fail(req, mapped.status, mapped.code);
  console.error('db error', err);
  return fail(req, 500, 'SERVER_ERROR');
}
