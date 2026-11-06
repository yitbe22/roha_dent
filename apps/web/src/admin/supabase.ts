// Supabase client for the staff dashboard only (lazy-loaded; public pages never import supabase-js).
// Uses the publishable/anon key + the signed-in user's session — RLS decides what each user sees.
import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient(url ?? 'http://invalid.local', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'roha-admin-auth' },
});

/** Call an Edge Function with the user's access token. Throws AdminError on non-2xx. */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const { data: s } = await supabase.auth.getSession();
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        apikey: key ?? '',
        Authorization: `Bearer ${s.session?.access_token ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AdminError('NETWORK', 'Network error — check the connection and try again.');
  }
  const data = await res.json().catch(() => undefined);
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new AdminError(e?.code ?? 'SERVER_ERROR', e?.message);
  }
  return data as T;
}

export class AdminError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}
