// Request schemas shared by the web app (client validation) and Edge Functions (server validation).
import { z } from 'zod';

const token = z.string().min(20).max(128).regex(/^[A-Za-z0-9_-]+$/);

/**
 * Link-like content is not allowed in a patient name: the first name is put into the SMS, so
 * "evil.com", "https:", e-mail addresses or phone numbers would let anyone send links via the
 * clinic. Same rule as SQL public._upsert_patient (migration 0011). Amharic and Latin names pass.
 */
export const NAME_NOT_ALLOWED = /(https?:|www\.|[a-z0-9-]\.[a-z]{2,}|[@/\\:<>]|[0-9])/i;
export const isAllowedName = (s: string) => !NAME_NOT_ALLOWED.test(s);

export const bookingRequestSchema = z.object({
  locationId: z.uuid(),
  serviceId: z.uuid(),
  dentistId: z.uuid().nullable(),
  startsAt: z.iso.datetime({ offset: true }),
  fullName: z.string().trim().min(2).max(100).refine(isAllowedName, 'INVALID_NAME'),
  phone: z.string().trim().min(9).max(20),
  notes: z.string().trim().max(500).optional(),
  turnstileToken: z.string().min(1).max(4096),
  /** Honeypot: real users never fill this. */
  website: z.string().max(0).optional(),
});
export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const manageRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('get'), token }),
  z.object({ action: z.literal('cancel'), token, reason: z.string().trim().max(500).optional() }),
  z.object({
    action: z.literal('reschedule'),
    token,
    startsAt: z.iso.datetime({ offset: true }),
    dentistId: z.uuid().nullable().optional(),
  }),
]);
export type ManageRequest = z.infer<typeof manageRequestSchema>;

/** Stable error codes returned by the Edge Functions (mapped to UI text in the web app). */
export const API_ERROR_CODES = [
  'VALIDATION', 'INVALID_JSON', 'METHOD_NOT_ALLOWED', 'INVALID_PHONE', 'UNSUPPORTED_NETWORK', 'INVALID_NAME',
  'INVALID_NOTES', 'RATE_LIMITED', 'TURNSTILE_FAILED', 'SLOT_UNAVAILABLE', 'TOO_MANY_ACTIVE_BOOKINGS', 'PATIENT_TIME_CONFLICT',
  'NOT_FOUND', 'CANNOT_CANCEL', 'CANNOT_RESCHEDULE', 'SERVER_ERROR',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
