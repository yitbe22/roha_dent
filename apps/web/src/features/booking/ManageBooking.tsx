import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatClinicDate, formatClinicTime, type TimeOption } from '@shared/time.ts';
import { ApiError, getCatalog, manageBooking, type PublicAppointment } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { TimePicker, ErrorLine } from './TimePicker';

const STATUS_STYLE: Record<PublicAppointment['status'], string> = {
  pending: 'bg-adey-soft text-roha-900 ring-adey',
  confirmed: 'bg-emerald-50 text-emerald-900 ring-emerald-300',
  cancelled: 'bg-mist text-ink-soft ring-line',
  completed: 'bg-mist text-ink-soft ring-line',
  no_show: 'bg-mist text-ink-soft ring-line',
};

export default function ManageBooking() {
  const { token = '' } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ['manage', token];

  const appt = useQuery({
    queryKey: key,
    queryFn: () => manageBooking({ action: 'get', token }).then((r) => r.appointment),
    retry: (n, e) => !(e instanceof ApiError && e.code === 'NOT_FOUND') && n < 2,
  });
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 5 * 60_000 });

  const [mode, setMode] = useState<'view' | 'cancel' | 'reschedule'>('view');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState<string>();
  const [slot, setSlot] = useState<TimeOption>();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDone = (a: PublicAppointment, msg: string) => {
    qc.setQueryData(key, a);
    setMode('view');
    setMessage(msg);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const onFail = (e: unknown) => {
    const code = e instanceof ApiError ? e.code : 'SERVER_ERROR';
    const phone = appt.data?.location.phone ?? '';
    if (code === 'SLOT_UNAVAILABLE') {
      setSlot(undefined);
      void qc.invalidateQueries({ queryKey: ['slots'] });
      setError(t('booking.errors.SLOT_UNAVAILABLE'));
    } else if (code === 'CANNOT_CANCEL' || code === 'CANNOT_RESCHEDULE') {
      setError(t('manage.cannot', { phone }));
      void appt.refetch();
    } else if (code === 'RATE_LIMITED' || code === 'NETWORK') {
      setError(t(`booking.errors.${code}`));
    } else {
      setError(t('booking.errors.generic'));
    }
  };

  const cancel = useMutation({
    mutationFn: () => manageBooking({ action: 'cancel', token, reason: reason || undefined }),
    onSuccess: (r) => onDone(r.appointment, t('manage.cancelled')),
    onError: onFail,
  });
  const reschedule = useMutation({
    mutationFn: (s: TimeOption) => manageBooking({ action: 'reschedule', token, startsAt: s.startsAt }),
    onSuccess: (r) => onDone(r.appointment, t('manage.rescheduled')),
    onError: onFail,
  });

  if (appt.isLoading) return <p className="text-ink-soft" aria-live="polite">{t('manage.loading')}</p>;
  if (appt.error instanceof ApiError && appt.error.code === 'NOT_FOUND') {
    return (
      <div className="max-w-xl">
        <p className="text-lede">{t('manage.notFound')}</p>
        <Link to="/book" className="btn-primary mt-6">{t('manage.bookAgain')}</Link>
      </div>
    );
  }
  if (appt.isError || !appt.data) return <ErrorLine onRetry={() => appt.refetch()} />;

  const a = appt.data;
  const active = a.status === 'pending' || a.status === 'confirmed';

  return (
    <div className="max-w-2xl">
      {message && (
        <p role="status" className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 font-medium text-emerald-900">
          {message}
        </p>
      )}
      <p className="text-ink-soft">{t('manage.hello', { name: a.patient_first_name })}</p>
      <div className="step-corner mt-3 bg-white p-6 ring-1 ring-line sm:p-8">
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ring-1 ${STATUS_STYLE[a.status]}`}>
          {t(`manage.status.${a.status}`)}
        </span>
        <p className={`mt-4 text-h2 font-bold text-roha-900 ${a.status === 'cancelled' ? 'line-through decoration-2' : ''}`}>
          {formatClinicDate(a.starts_at, 'en-GB', false)}, {formatClinicTime(a.starts_at)}
        </p>
        <p className="mt-2 text-lg">
          {a.service.name}, {t('manage.with', { dentist: a.dentist.full_name })}
        </p>
        <p className="mt-4 flex items-start gap-2 text-ink-soft">
          <Icon name="pin" className="mt-0.5 size-5 shrink-0 text-roha-500" />
          <span>
            {a.location.name}
            {a.location.address && <span className="block">{a.location.address}</span>}
          </span>
        </p>
        <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
          <a href={`tel:${a.location.phone.replace(/\s/g, '')}`} className="btn-ghost"><Icon name="phone" />{a.location.phone}</a>
          {a.location.map_url && (
            <a href={a.location.map_url} target="_blank" rel="noopener" className="btn-ghost"><Icon name="pin" />{t('cta.directions')}</a>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900">{error}</p>
      )}

      {active && mode === 'view' && (
        a.can_cancel || a.can_reschedule ? (
          <div className="mt-8 flex flex-wrap gap-3">
            {a.can_reschedule && (
              <button type="button" className="btn-primary" onClick={() => { setMode('reschedule'); setError(null); }}>
                <Icon name="calendar" />{t('manage.reschedule')}
              </button>
            )}
            {a.can_cancel && (
              <button type="button" className="btn-ghost" onClick={() => { setMode('cancel'); setError(null); }}>
                {t('manage.cancel')}
              </button>
            )}
          </div>
        ) : (
          <p className="mt-8 text-ink-soft">{t('manage.tooLate', { phone: a.location.phone })}</p>
        )
      )}

      {mode === 'cancel' && (
        <section aria-labelledby="cancel-h" className="mt-8 rounded-xl border-2 border-red-200 bg-white p-6">
          <h2 id="cancel-h" className="text-h3">{t('manage.cancelConfirm')}</h2>
          <label htmlFor="reason" className="mt-4 block font-semibold">{t('manage.cancelReason')}</label>
          <textarea id="reason" rows={2} maxLength={500} className="input mt-2" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn bg-red-700 text-white hover:bg-red-800" disabled={cancel.isPending}
              onClick={() => cancel.mutate()}>
              {t('manage.cancelYes')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMode('view')}>{t('manage.cancelNo')}</button>
          </div>
        </section>
      )}

      {mode === 'reschedule' && catalog.data && (
        <section aria-labelledby="resched-h" className="mt-8">
          <h2 id="resched-h" className="text-h2">{t('booking.time.title')}</h2>
          <div className="mt-6">
            <TimePicker
              locationId={a.location.id}
              serviceId={a.service.id}
              dentistId={null}
              maxAdvanceDays={catalog.data.settings.max_advance_days}
              clinicPhone={a.location.phone}
              date={date}
              onDate={(d) => { setDate(d); setSlot(undefined); }}
              value={slot}
              onChange={setSlot}
              excludeStart={new Date(a.starts_at).toISOString()}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" disabled={!slot || reschedule.isPending}
              onClick={() => slot && reschedule.mutate(slot)}>
              {slot
                ? t('manage.rescheduleConfirm', { date: formatClinicDate(slot.startsAt, 'en-GB', false), time: formatClinicTime(slot.startsAt) })
                : t('manage.reschedule')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMode('view')}>{t('booking.back')}</button>
          </div>
        </section>
      )}

      {!active && (
        <Link to={`/book?location=${a.location.slug}&service=${a.service.slug}`} className="btn-primary mt-8">
          {t('manage.bookAgain')}
        </Link>
      )}
    </div>
  );
}
