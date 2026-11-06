// Tiny fetch client for the public booking API (no supabase-js on public pages).
import type { ApiErrorCode, BookingRequest, ManageRequest } from '@shared/schemas.ts';
import type { SlotRow } from '@shared/time.ts';

const BASE = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const bookingConfigured = Boolean(BASE && KEY);

export class ApiError extends Error {
  constructor(public code: ApiErrorCode | 'NETWORK', public status: number, public details?: unknown) {
    super(code);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!BASE || !KEY) throw new ApiError('SERVER_ERROR', 0);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('NETWORK', 0);
  }
  const data = await res.json().catch(() => undefined);
  if (!res.ok) {
    const code = (data as { error?: { code?: ApiErrorCode } } | undefined)?.error?.code ?? 'SERVER_ERROR';
    throw new ApiError(code, res.status, (data as { error?: { details?: unknown } })?.error?.details);
  }
  return data as T;
}

const rpc = <T>(fn: string, args: Record<string, unknown>) => post<T>(`/rest/v1/rpc/${fn}`, args);
const fn = <T>(name: string, body: unknown) => post<T>(`/functions/v1/${name}`, body);

// ---- types -----------------------------------------------------------------

export type CatalogLocation = { id: string; slug: string; name: string; city: string; phone: string };
export type CatalogService = { id: string; slug: string; name: string; summary: string | null; duration_minutes: number };
export type CatalogDentist = {
  id: string; slug: string; full_name: string; title: string | null; service_ids: string[]; location_ids: string[];
};
export type Catalog = {
  locations: CatalogLocation[];
  services: CatalogService[];
  dentists: CatalogDentist[];
  settings: { max_advance_days: number; min_lead_minutes: number; cancel_cutoff_minutes: number };
};

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export type PublicAppointment = {
  id: string;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  patient_first_name: string;
  service: { id: string; slug: string; name: string; duration_minutes: number };
  location: { id: string; slug: string; name: string; phone: string; address: string | null; map_url: string | null };
  dentist: { id: string; full_name: string };
  can_cancel: boolean;
  can_reschedule: boolean;
};

export type BookingResult = {
  appointment: { id: string; status: AppointmentStatus; dentistId: string; startsAt: string; endsAt: string };
  manageToken: string;
  manageUrl: string;
};

// ---- calls -----------------------------------------------------------------

export const getCatalog = () => rpc<Catalog>('get_booking_catalog', {});

export const getAvailableDates = (a: { locationId: string; serviceId: string; dentistId: string | null; from: string; to: string }) =>
  rpc<{ day: string; slot_count: number }[]>('get_available_dates', {
    p_location_id: a.locationId, p_service_id: a.serviceId, p_from: a.from, p_to: a.to, p_dentist_id: a.dentistId,
  });

export const getAvailableSlots = (a: { locationId: string; serviceId: string; dentistId: string | null; date: string }) =>
  rpc<SlotRow[]>('get_available_slots', {
    p_location_id: a.locationId, p_service_id: a.serviceId, p_date: a.date, p_dentist_id: a.dentistId,
  });

export const createBooking = (req: BookingRequest) => fn<BookingResult>('create-booking', req);

export const manageBooking = (req: ManageRequest) => fn<{ appointment: PublicAppointment }>('manage-booking', req);
