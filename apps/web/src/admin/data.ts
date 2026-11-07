import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Dentist, DentistService, Location, Service, WorkingHours } from './types';

// ---- reference data (locations, services, dentists, who works where) -------------------

export type Lookups = {
  locations: Location[];
  services: Service[];
  dentists: Dentist[];
  dentistServices: DentistService[];
  workingHours: WorkingHours[];
  location: (id: string | null | undefined) => Location | undefined;
  service: (id: string | null | undefined) => Service | undefined;
  dentist: (id: string | null | undefined) => Dentist | undefined;
  /** Active dentists who work at the location (have hours there) and offer the service. */
  dentistsFor: (locationId: string, serviceId?: string) => Dentist[];
};

async function rows<T>(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as T[];
}

export function useLookups() {
  const q = useQuery({
    queryKey: ['lookups'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [locations, services, dentists, dentistServices, workingHours] = await Promise.all([
        rows<Location>(supabase.from('locations').select('id, slug, name, city, phone, address, alert_phone, opening_hours_note, is_active, sort_order').order('sort_order')),
        rows<Service>(supabase.from('services').select('id, slug, name, summary, duration_minutes, price_from_etb, is_bookable, is_active, sort_order').order('sort_order')),
        rows<Dentist>(supabase.from('dentists').select('id, slug, full_name, title, accepts_online_booking, is_active, sort_order').order('sort_order')),
        rows<DentistService>(supabase.from('dentist_services').select('dentist_id, service_id')),
        rows<WorkingHours>(supabase.from('working_hours').select('id, dentist_id, location_id, weekday, start_time, end_time').order('weekday').order('start_time')),
      ]);
      return { locations, services, dentists, dentistServices, workingHours };
    },
  });

  const data = useMemo<Lookups | undefined>(() => {
    if (!q.data) return undefined;
    const { locations, services, dentists, dentistServices, workingHours } = q.data;
    const byId = <T extends { id: string }>(list: T[]) => {
      const m = new Map(list.map((x) => [x.id, x]));
      return (id: string | null | undefined) => (id ? m.get(id) : undefined);
    };
    return {
      ...q.data,
      location: byId(locations),
      service: byId(services),
      dentist: byId(dentists),
      dentistsFor: (locationId, serviceId) =>
        dentists.filter(
          (d) =>
            d.is_active &&
            workingHours.some((w) => w.dentist_id === d.id && w.location_id === locationId) &&
            (!serviceId || dentistServices.some((ds) => ds.dentist_id === d.id && ds.service_id === serviceId)),
        ),
    };
  }, [q.data]);

  return { ...q, data };
}

// ---- realtime: refresh queries when rows change ----------------------------------------

/** Invalidate the given query-key prefixes whenever `table` changes (RLS-filtered by Realtime). */
export function useRealtimeRefresh(table: 'appointments' | 'sms_log', keys: string[][], onInsert?: (row: Record<string, unknown>) => void) {
  const qc = useQueryClient();
  const sig = JSON.stringify(keys);
  useEffect(() => {
    const channel = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        for (const k of JSON.parse(sig) as string[][]) qc.invalidateQueries({ queryKey: k });
        if (payload.eventType === 'INSERT' && onInsert) onInsert(payload.new as Record<string, unknown>);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, sig, qc]);
}

// ---- errors -----------------------------------------------------------------------------

const BUSINESS: Record<string, string> = {
  SLOT_UNAVAILABLE: 'That time is no longer free for this dentist.',
  INVALID_PHONE: 'Enter a valid Ethio Telecom mobile number (09…).',
  INVALID_NAME: 'Enter the patient’s full name (2–100 characters).',
  INVALID_SERVICE: 'That service is not active.',
  INVALID_DENTIST: 'That dentist is not active.',
  INVALID_TIME: 'The end time must be after the start time.',
  TOO_MANY_ACTIVE_BOOKINGS: 'This patient already has the maximum number of upcoming bookings.',
  PATIENT_TIME_CONFLICT: 'This phone number already has an appointment at that time.',
  FORBIDDEN: 'You don’t have permission to do that.',
  EMAIL_TAKEN: 'An account with that email already exists.',
  LOCATION_REQUIRED: 'Staff accounts need a clinic.',
  SELF_CHANGE: 'You cannot deactivate or demote your own account.',
  UNAUTHORIZED: 'Your session has expired — sign in again.',
};

/** Human message for PostgREST / RPC / Edge Function errors. */
export function errorMessage(e: unknown): string {
  const err = (e ?? {}) as { code?: string; message?: string; details?: string };
  if (err.message && BUSINESS[err.message]) return BUSINESS[err.message];
  if (err.code && BUSINESS[err.code]) return BUSINESS[err.code];
  switch (err.code) {
    case '23P01':
      return /working_hours/.test(err.message ?? '')
        ? 'This overlaps another shift of the same dentist (possibly at the other clinic).'
        : 'That time overlaps another appointment for this dentist.';
    case '42501':
      return 'You don’t have permission to do that.';
    case '23505':
      return 'That already exists.';
    case '23514':
      return 'Some values are not allowed — check the form.';
    case '23503':
      return 'This is still used elsewhere and can’t be removed.';
    case 'PGRST116':
      return 'Not found (or you don’t have access to it).';
    case 'NETWORK':
      return 'Network error — check the connection and try again.';
  }
  if (/Failed to fetch|NetworkError/i.test(err.message ?? '')) return 'Network error — check the connection and try again.';
  return err.message || 'Something went wrong.';
}

// ---- counts -----------------------------------------------------------------------------

/** Upcoming bookings still waiting for staff to confirm (in the current clinic filter). */
export function usePendingCount(scope: string | null) {
  return useQuery({
    queryKey: ['pending-count', scope],
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = supabase.from('appointments').select('id', { count: 'exact', head: true })
        .eq('status', 'pending').gte('starts_at', new Date().toISOString());
      if (scope) q = q.eq('location_id', scope);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
}
