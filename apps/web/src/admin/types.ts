// Row shapes used by the dashboard (hand-written subset of the schema in supabase/migrations).

export type Role = 'owner' | 'staff';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type AppointmentSource = 'online' | 'phone' | 'walk_in' | 'admin';
export type SmsType =
  | 'booking_received' | 'booking_confirmed' | 'booking_cancelled' | 'booking_rescheduled'
  | 'reminder_24h' | 'reminder_2h' | 'clinic_new_booking';
export type SmsStatus =
  | 'queued' | 'sending' | 'dry_run' | 'accepted' | 'sent' | 'delivered'
  | 'undelivered' | 'failed' | 'rejected' | 'expired' | 'skipped';

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  location_id: string | null;
  is_active: boolean;
};

export type Location = {
  id: string; slug: string; name: string; city: string; phone: string; address: string | null;
  alert_phone: string | null; opening_hours_note: string | null; is_active: boolean; sort_order: number;
};
export type Service = {
  id: string; slug: string; name: string; summary: string | null; duration_minutes: number;
  price_from_etb: number | null; is_bookable: boolean; is_active: boolean; sort_order: number;
};
export type Dentist = {
  id: string; slug: string; full_name: string; title: string | null; accepts_online_booking: boolean;
  is_active: boolean; sort_order: number;
};
export type DentistService = { dentist_id: string; service_id: string };
export type WorkingHours = {
  id: string; dentist_id: string; location_id: string; weekday: number; start_time: string; end_time: string;
};
export type TimeOff = {
  id: string; dentist_id: string | null; location_id: string | null; starts_at: string; ends_at: string;
  reason: string | null; created_at: string;
};

export type PatientLite = { id: string; full_name: string; phone: string };
export type Patient = PatientLite & { email: string | null; notes: string | null; created_at: string };

export type Appointment = {
  id: string;
  location_id: string;
  dentist_id: string;
  service_id: string;
  patient_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  patient_notes: string | null;
  internal_notes: string | null;
  reschedule_count: number;
  cancel_reason: string | null;
  cancelled_by: 'patient' | 'staff' | 'system' | null;
  created_at: string;
  patient: PatientLite;
};

export type SmsRow = {
  id: string;
  appointment_id: string | null;
  location_id: string | null;
  type: SmsType;
  to_phone: string;
  body: string;
  segments: number | null;
  encoding: 'gsm7' | 'ucs2' | null;
  status: SmsStatus;
  error_code: string | null;
  error: string | null;
  attempts: number;
  resend_of: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type Settings = {
  auto_confirm: boolean;
  slot_interval_minutes: number;
  min_lead_minutes: number;
  max_advance_days: number;
  cancel_cutoff_minutes: number;
  max_reschedules: number;
  max_active_bookings_per_patient: number;
  sms_enabled: boolean;
  owner_alert_phones: string[];
  public_site_url: string;
  updated_at: string;
};

export type SmsTemplate = { key: SmsType; locale: 'en' | 'am'; body: string; is_active: boolean; updated_at: string };

export type AuditRow = {
  id: number; actor_id: string | null; actor_type: 'staff' | 'patient' | 'system'; action: string; entity: string;
  entity_id: string | null; location_id: string | null; changes: Record<string, unknown> | null; created_at: string;
};

export const APPOINTMENT_SELECT =
  'id, location_id, dentist_id, service_id, patient_id, starts_at, ends_at, status, source, patient_notes, internal_notes, reschedule_count, cancel_reason, cancelled_by, created_at, patient:patients(id, full_name, phone)';

// Plain words for front-desk staff.
export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: 'To confirm', confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Visited', no_show: 'Didn’t come',
};
export const SOURCE_LABEL: Record<AppointmentSource, string> = {
  online: 'Website', phone: 'Phone call', walk_in: 'Walk-in', admin: 'Staff',
};
export const SMS_TYPE_LABEL: Record<SmsType, string> = {
  booking_received: 'Request received',
  booking_confirmed: 'Booking confirmed',
  booking_cancelled: 'Booking cancelled',
  booking_rescheduled: 'New time',
  reminder_24h: 'Reminder (day before)',
  reminder_2h: 'Reminder (2 hours before)',
  clinic_new_booking: 'Alert to clinic',
};
export const SMS_TYPES = Object.keys(SMS_TYPE_LABEL) as SmsType[];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** SMS delivery state in plain words, with what staff should do about it. */
export function smsState(status: SmsStatus): { label: string; tone: 'ok' | 'wait' | 'bad' | 'off'; help: string } {
  switch (status) {
    case 'delivered': return { label: 'Delivered', tone: 'ok', help: 'The message reached the phone.' };
    case 'queued': case 'sending': return { label: 'Waiting to send', tone: 'wait', help: 'It will be sent within a minute.' };
    case 'accepted': case 'sent': return { label: 'Sending…', tone: 'wait', help: 'Sent to the phone network; waiting for the delivery report.' };
    case 'undelivered': case 'expired': return { label: 'Not delivered', tone: 'bad', help: 'The phone may be off or out of coverage. Call the patient, or press “Send again” later.' };
    case 'failed': case 'rejected': return { label: 'Not sent', tone: 'bad', help: 'See the reason below. Call the patient so they are informed.' };
    case 'skipped': return { label: 'Not sent (SMS off)', tone: 'off', help: 'SMS or this message type is switched off in Settings.' };
    case 'dry_run': return { label: 'Test mode', tone: 'off', help: 'SMS was in test mode — nothing was sent.' };
  }
}

/** Provider error codes → what to do. */
export const SMS_ERROR_HELP: Record<string, string> = {
  '10000': 'The phone number is not an Ethio Telecom 09… number.',
  '10002': 'The SMS account is not active. Tell the clinic owner.',
  '10005': 'SMS credit has run out. Tell the clinic owner to top up SMS Ethiopia.',
  '10006': 'The sender name is not approved yet. Tell the clinic owner.',
  '10007': 'The SMS account is in test mode and this number is not on its allowed list.',
  AUTH: 'The SMS account key is wrong. Tell the clinic owner.',
  CONFIG: 'SMS is not set up yet. Tell the clinic owner.',
};
