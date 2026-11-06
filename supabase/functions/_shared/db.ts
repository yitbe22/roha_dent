// Service-role Supabase client (bypasses RLS). Only ever used inside Edge Functions.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

export function admin(): SupabaseClient {
  if (!client) {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

/** Fixed-window rate limit. Fails open (logs) if the limiter itself errors — Turnstile is the primary gate. */
export async function allow(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await admin().rpc('hit_rate_limit', {
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('rate limiter error', error);
    return true;
  }
  return data === true;
}

export function publicSiteUrl(): string {
  return (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://rohadent.com').replace(/\/$/, '');
}

export const manageUrl = (token: string) => `${publicSiteUrl()}/b/${token}`;
