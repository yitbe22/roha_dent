import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Profile } from './types';

type AuthState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null | undefined; // undefined = loading, null = no profile row (no access)
  profileError: boolean;
  isOwner: boolean;
  mustChangePassword: boolean;
  signOut: () => Promise<void>;
  /** Location filter for lists: staff are pinned to their clinic; owner picks one or null (= all). */
  scope: string | null;
  setScope: (id: string | null) => void;
};

const Ctx = createContext<AuthState | null>(null);
const SCOPE_KEY = 'roha-admin-scope';

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setReady(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;
  const profileQ = useQuery({
    queryKey: ['me', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, location_id, is_active')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
  });

  const profile = userId ? (profileQ.isPending ? undefined : profileQ.data ?? null) : null;
  const isOwner = profile?.role === 'owner' && profile.is_active;

  const [ownerScope, setOwnerScope] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SCOPE_KEY) || null;
    } catch {
      return null;
    }
  });
  const scope = isOwner ? ownerScope : profile?.location_id ?? null;
  const setScope = (id: string | null) => {
    setOwnerScope(id);
    try {
      if (id) localStorage.setItem(SCOPE_KEY, id);
      else localStorage.removeItem(SCOPE_KEY);
    } catch { /* private mode */ }
  };

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      profile,
      profileError: profileQ.isError,
      isOwner,
      mustChangePassword: Boolean(session?.user.user_metadata?.must_change_password),
      scope,
      setScope,
      signOut: async () => {
        await supabase.auth.signOut();
        qc.clear();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, session, profile, profileQ.isError, isOwner, scope],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
