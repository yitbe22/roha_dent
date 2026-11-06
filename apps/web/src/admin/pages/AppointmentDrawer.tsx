import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clinicDateKey, clinicIso, formatClinicDate, formatClinicTime, minutesBetween } from '@shared/time.ts';
import { formatEthiopianPhone } from '@shared/phone.ts';
import { supabase } from '../supabase';
import { errorMessage, useLookups } from '../data';
import { APPOINTMENT_SELECT, SMS_ERROR_HELP, SMS_TYPE_LABEL, SOURCE_LABEL, smsState, type Appointment, type AppointmentStatus, type SmsRow } from '../types';
import { CallButton, Drawer, ErrorBox, Field, Loading, SmsBadge, StatusBadge, Tip, btn, fmtDateTime, inputCls, useConfirm, useToast } from '../ui';
import { SlotField } from './SlotField';
import { Icon } from '../../components/Icon';

type Mode = 'view' | 'cancel' | 'reschedule';

export function AppointmentDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const appt = useQuery({
    queryKey: ['appointment', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('appointments').select(APPOINTMENT_SELECT).eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as unknown as Appointment | null;
    },
  });

  return (
    <Drawer open={!!id} onClose={onClose} title="Appointment details">
      {appt.isError ? (
        <ErrorBox error={errorMessage(appt.error)} onRetry={() => appt.refetch()} />
      ) : appt.isPending ? (
        <Loading />
      ) : !appt.data ? (
        <ErrorBox error="This appointment could not be found. It may belong to the other clinic." />
      ) : (
        <Body a={appt.data} key={appt.data.id} />
      )}
    </Drawer>
  );
}

function Body({ a }: { a: Appointment }) {
  const { data: lk } = useLookups();
  const qc = useQueryClient();
  const toast = useToast();
  const ask = useConfirm();
  const [mode, setMode] = useState<Mode>('view');
  const [notes, setNotes] = useState(a.internal_notes ?? '');
  useEffect(() => setNotes(a.internal_notes ?? ''), [a.internal_notes]);

  const refresh = () => {
    for (const k of ['appointment', 'appointments', 'pending-count', 'patient', 'appointment-sms']) qc.invalidateQueries({ queryKey: [k] });
  };
  const update = useMutation({
    mutationFn: async ({ patch }: { patch: Record<string, unknown>; done: string }) => {
      const { error } = await supabase.from('appointments').update(patch).eq('id', a.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast(v.done);
      setMode('view');
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const setStatus = (status: AppointmentStatus, done: string, extra: Record<string, unknown> = {}) =>
    update.mutate({ patch: { status, ...extra }, done });

  const first = a.patient.full_name.split(' ')[0];
  const active = a.status === 'pending' || a.status === 'confirmed';
  const started = new Date(a.starts_at).getTime() <= Date.now();
  const service = lk?.service(a.service_id);
  const dentist = lk?.dentist(a.dentist_id);

  return (
    <div className="space-y-6">
      {/* who & when */}
      <div className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-bold text-roha-900">{a.patient.full_name}</p>
            <Link to={`/admin/patients/${a.patient.id}`} className="link text-sm">See all visits of this patient</Link>
          </div>
          <StatusBadge status={a.status} />
        </div>
        <div className="mt-3"><CallButton e164={a.patient.phone} /></div>

        <div className="mt-5 rounded-lg bg-enamel p-4">
          <p className="text-lg font-bold text-roha-900">{formatClinicDate(a.starts_at)}</p>
          <p className="text-2xl font-bold tabular-nums text-roha-900">{formatClinicTime(a.starts_at)} – {formatClinicTime(a.ends_at)}</p>
          <p className="mt-2">{service?.name} with {dentist?.full_name}</p>
          <p className="text-ink-soft">{lk?.location(a.location_id)?.city} clinic · booked by {SOURCE_LABEL[a.source].toLowerCase()} on {fmtDateTime(a.created_at)}</p>
          {a.reschedule_count > 0 && <p className="text-ink-soft">Time changed {a.reschedule_count}×</p>}
        </div>

        {a.patient_notes && (
          <p className="mt-4 rounded-lg bg-adey-soft px-4 py-3"><b>The patient wrote:</b> “{a.patient_notes}”</p>
        )}
        {a.status === 'cancelled' && (
          <p className="mt-4 text-ink-soft">
            Cancelled by {a.cancelled_by === 'patient' ? 'the patient (with the SMS link)' : a.cancelled_by === 'staff' ? 'staff' : 'the system'}
            {a.cancel_reason ? ` — “${a.cancel_reason}”` : ''}.
          </p>
        )}
      </div>

      {/* what to do now */}
      {mode === 'view' && (
        <div className="space-y-3">
          {a.status === 'pending' && (
            <>
              <Tip>
                <p className="font-semibold">This is a new request. What to do:</p>
                <ol className="list-decimal space-y-0.5 pl-5">
                  <li>Call {first} and check the day and time are right.</li>
                  <li>Press <b>Confirm booking</b>. {first} gets a confirmation SMS automatically.</li>
                </ol>
                <p className="text-sm">If the time does not suit, press <b>Change time</b> instead.</p>
              </Tip>
              <ActionButton primary icon="check" disabled={update.isPending}
                title="Confirm booking" text={`${first} gets a confirmation SMS.`}
                onClick={() => setStatus('confirmed', `Confirmed. ${first} gets a confirmation SMS.`)} />
            </>
          )}
          {a.status === 'confirmed' && started && (
            <>
              <ActionButton primary icon="check" disabled={update.isPending} title="Patient came" text="Mark the visit as done."
                onClick={() => setStatus('completed', 'Marked as visited')} />
              <ActionButton icon="close" disabled={update.isPending} title="Patient did not come" text="Counts as a missed appointment."
                onClick={() => setStatus('no_show', 'Marked as “didn’t come”')} />
            </>
          )}
          {active && (
            <>
              <ActionButton icon="calendar" title="Change time or dentist" text={`${first} gets an SMS with the new time.`} onClick={() => setMode('reschedule')} />
              <ActionButton icon="close" danger title="Cancel booking" text={`${first} gets a cancellation SMS.`} onClick={() => setMode('cancel')} />
            </>
          )}
          {a.status === 'confirmed' && !started && (
            <p className="text-sm text-ink-soft">“Patient came” and “did not come” appear here once the appointment time has started.</p>
          )}
          {(a.status === 'completed' || a.status === 'no_show') && (
            <ActionButton icon="refresh" disabled={update.isPending} title="Undo" text="Changed by mistake? Put it back to confirmed."
              onClick={() => setStatus('confirmed', 'Put back to confirmed')} />
          )}
          {a.status === 'cancelled' && (
            <ActionButton icon="refresh" disabled={update.isPending} title="Restore this booking"
              text="Makes it confirmed again (only if the time is still free). No SMS is sent — call the patient."
              onClick={async () => {
                if (await ask({ title: 'Restore this booking?', text: `It will be confirmed again for ${formatClinicDate(a.starts_at)} at ${formatClinicTime(a.starts_at)}. No SMS is sent, so please call ${first}.`, yes: 'Yes, restore' })) {
                  setStatus('confirmed', 'Booking restored');
                }
              }} />
          )}
        </div>
      )}

      {mode === 'cancel' && (
        <CancelForm first={first} busy={update.isPending} onBack={() => setMode('view')}
          onCancel={(reason) => setStatus('cancelled', `Cancelled. ${first} gets a cancellation SMS.`, { cancel_reason: reason || null })} />
      )}
      {mode === 'reschedule' && (
        <RescheduleForm a={a} first={first} busy={update.isPending} onBack={() => setMode('view')}
          onSave={(patch) => update.mutate({ patch, done: `Time changed. ${first} gets an SMS with the new time.` })} />
      )}

      {/* staff notes */}
      <div className="rounded-xl border border-line bg-white p-5">
        <Field label="Notes for the team" hint="Only staff see these notes — the patient does not.">
          <textarea className={`${inputCls} min-h-24`} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Prefers afternoon, bring X-ray from last visit" />
        </Field>
        {notes !== (a.internal_notes ?? '') && (
          <div className="mt-3 flex gap-2">
            <button type="button" className={btn.primary} disabled={update.isPending}
              onClick={() => update.mutate({ patch: { internal_notes: notes.trim() || null }, done: 'Notes saved' })}>
              Save notes
            </button>
            <button type="button" className={btn.ghost} onClick={() => setNotes(a.internal_notes ?? '')}>Discard</button>
          </div>
        )}
      </div>

      <SmsHistory appointmentId={a.id} />
    </div>
  );
}

function ActionButton({ title, text, icon, onClick, primary, danger, disabled }: {
  title: string; text: string; icon: 'check' | 'close' | 'calendar' | 'refresh'; onClick: () => void; primary?: boolean; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex w-full items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-colors disabled:opacity-50 ${
        primary ? 'border-roha-700 bg-roha-700 text-white hover:bg-roha-800'
          : danger ? 'border-red-200 bg-white text-red-800 hover:bg-red-50'
            : 'border-line bg-white text-roha-900 hover:border-roha-300'
      }`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${primary ? 'bg-white/15' : danger ? 'bg-red-50' : 'bg-roha-50'}`}>
        <Icon name={icon} className="size-5" />
      </span>
      <span>
        <span className="block text-lg font-bold">{title}</span>
        <span className={`block text-sm ${primary ? 'text-roha-100' : 'text-ink-soft'}`}>{text}</span>
      </span>
    </button>
  );
}

function CancelForm({ first, busy, onBack, onCancel }: { first: string; busy: boolean; onBack: () => void; onCancel: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-4 rounded-xl border-2 border-red-200 bg-white p-5">
      <p className="text-lg font-bold text-red-800">Cancel this booking?</p>
      <p className="text-ink-soft">{first} will get an SMS saying the appointment is cancelled. The time becomes free for others.</p>
      <Field label="Why? (optional — only staff see this)">
        <input className={inputCls} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Patient called — travelling" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn min-h-11 bg-red-700 px-5 text-white hover:bg-red-800 disabled:opacity-50" disabled={busy}
          onClick={() => onCancel(reason.trim())}>Yes, cancel booking</button>
        <button type="button" className={btn.ghost} onClick={onBack}>No, keep it</button>
      </div>
    </div>
  );
}

function RescheduleForm({ a, first, busy, onBack, onSave }: { a: Appointment; first: string; busy: boolean; onBack: () => void; onSave: (patch: Record<string, unknown>) => void }) {
  const { data: lk } = useLookups();
  const [dentistId, setDentistId] = useState(a.dentist_id);
  const [date, setDate] = useState(clinicDateKey(a.starts_at));
  const [time, setTime] = useState('');
  const dentists = lk?.dentistsFor(a.location_id, a.service_id) ?? [];
  if (!dentists.some((d) => d.id === a.dentist_id)) {
    const cur = lk?.dentist(a.dentist_id);
    if (cur) dentists.unshift(cur);
  }
  const duration = minutesBetween(a.starts_at, a.ends_at);
  const valid = /^\d{2}:\d{2}$/.test(time) && !!date;

  function save() {
    const startsAt = clinicIso(date, time);
    const endsAt = new Date(new Date(startsAt).getTime() + duration * 60_000).toISOString();
    onSave({ starts_at: startsAt, ends_at: endsAt, dentist_id: dentistId });
  }

  return (
    <div className="space-y-5 rounded-xl border-2 border-roha-200 bg-white p-5">
      <div>
        <p className="text-lg font-bold text-roha-900">Change time</p>
        <p className="text-ink-soft">Now: {formatClinicDate(a.starts_at, 'en-GB', false)} at {formatClinicTime(a.starts_at)}. Pick the new day and time.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Day">
          <input type="date" className={inputCls} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} />
        </Field>
        <Field label="Dentist">
          <select className={inputCls} value={dentistId} onChange={(e) => { setDentistId(e.target.value); setTime(''); }}>
            {dentists.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </Field>
      </div>
      <SlotField locationId={a.location_id} serviceId={a.service_id} dentistId={dentistId} date={date}
        time={time} onTime={setTime} excludeStart={a.starts_at} />
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <button type="button" className={btn.primary} disabled={busy || !valid} onClick={save}>
          {valid ? `Move to ${formatClinicDate(date, 'en-GB', false)} at ${time}` : 'Pick a time first'}
        </button>
        <button type="button" className={btn.ghost} onClick={onBack}>Back</button>
      </div>
      {valid && <p className="text-sm text-ink-soft">{first} gets an SMS with the new time.</p>}
    </div>
  );
}

export function SmsHistory({ appointmentId }: { appointmentId: string }) {
  const toast = useToast();
  const ask = useConfirm();
  const qc = useQueryClient();
  const sms = useQuery({
    queryKey: ['appointment-sms', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sms_log')
        .select('id, appointment_id, location_id, type, to_phone, body, segments, encoding, status, error_code, error, attempts, resend_of, sent_at, delivered_at, created_at')
        .eq('appointment_id', appointmentId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as SmsRow[];
    },
  });
  const resend = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('resend_sms', { p_sms_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast('The message will be sent again in a moment');
      qc.invalidateQueries({ queryKey: ['appointment-sms'] });
      qc.invalidateQueries({ queryKey: ['sms'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  return (
    <div>
      <h3 className="mb-1 text-lg">Text messages for this booking</h3>
      <p className="mb-3 text-sm text-ink-soft">Sent automatically. You only need to act if one shows a red label.</p>
      {sms.isError ? (
        <ErrorBox error={errorMessage(sms.error)} onRetry={() => sms.refetch()} />
      ) : sms.isPending ? (
        <Loading />
      ) : sms.data.length === 0 ? (
        <p className="text-ink-soft">No messages yet.</p>
      ) : (
        <ul className="space-y-2">
          {sms.data.map((m) => {
            const st = smsState(m.status);
            return (
              <li key={m.id} className={`rounded-xl border bg-white p-4 ${st.tone === 'bad' ? 'border-red-200' : 'border-line'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{SMS_TYPE_LABEL[m.type]}</span>
                  <SmsBadge status={m.status} />
                  <span className="text-sm text-ink-soft">{fmtDateTime(m.created_at)} · to {formatEthiopianPhone(m.to_phone)}</span>
                </div>
                {st.tone === 'bad' && (
                  <p className="mt-2 text-sm text-red-800">
                    {(m.error_code && SMS_ERROR_HELP[m.error_code]) || m.error || st.help}
                  </p>
                )}
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-roha-700">Show the message</summary>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-enamel p-3 text-ink-soft">{m.body}</p>
                </details>
                <button type="button" className={`${btn.small} mt-2`} disabled={resend.isPending}
                  onClick={async () => {
                    if (await ask({ title: 'Send this message again?', text: `The same text goes to ${formatEthiopianPhone(m.to_phone)} again.`, yes: 'Send again' })) resend.mutate(m.id);
                  }}>
                  Send again
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
