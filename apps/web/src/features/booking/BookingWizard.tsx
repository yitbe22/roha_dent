import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { normalizeEthiopianPhone, formatEthiopianPhone } from '@shared/phone.ts';
import { isAllowedName } from '@shared/schemas.ts';
import {
  addDays, clinicDateKey, ethiopianTime, formatClinicDate, formatClinicTime, groupSlots, splitByPartOfDay, type TimeOption,
} from '@shared/time.ts';
import {
  ApiError, createBooking, getAvailableDates, getAvailableSlots, getCatalog, type BookingResult, type Catalog,
} from '../../lib/api';
import { ArrowRight } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { ErrorLine } from './TimePicker';
import { Turnstile } from './Turnstile';

/** The "not sure yet" check-up (migration 20261107000013). Every dentist offers it. */
const NOT_SURE = 'checkup';

const schema = z.object({
  fullName: z.string().trim().min(2, 'nameRequired').max(100, 'nameRequired').refine(isAllowedName, 'nameInvalid'),
  phone: z
    .string()
    .trim()
    .min(1, 'phoneRequired')
    .superRefine((v, ctx) => {
      const r = normalizeEthiopianPhone(v);
      if (!r.ok && r.error !== 'EMPTY') {
        ctx.addIssue({ code: 'custom', message: r.error === 'UNSUPPORTED_NETWORK' ? 'phoneNetwork' : 'phoneInvalid' });
      }
    }),
  notes: z.string().trim().max(500).optional(),
  website: z.string().max(0).optional(),
});
type Details = z.infer<typeof schema>;

/** Dentists who offer a service at a location (from the catalog). */
const dentistsFor = (c: Catalog, locationId?: string, serviceId?: string) =>
  c.dentists.filter(
    (d) => (!locationId || d.location_ids.includes(locationId)) && (!serviceId || d.service_ids.includes(serviceId)),
  );

/**
 * One short form, like the clinic's own site: name, phone, treatment, branch, date.
 * Once a date is picked, that day's free times appear underneath.
 */
export default function BookingWizard() {
  const { t, i18n } = useTranslation();
  const localLang = i18n.language?.startsWith('am') ? 'am' : 'en';
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 5 * 60_000 });
  const c = catalog.data;

  const [locationId, setLocationId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [dentistId, setDentistId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState<TimeOption>();
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [slotError, setSlotError] = useState(false);
  const [result, setResult] = useState<{ res: BookingResult; phone: string } | null>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const timesRef = useRef<HTMLDivElement>(null);

  const notSure = c?.services.find((s) => s.slug === NOT_SURE);

  // Defaults: ?location=&service=&dentist= (slugs) if given, else the first branch and "not sure yet".
  useEffect(() => {
    if (!c || ready) return;
    const den = c.dentists.find((d) => d.slug === params.get('dentist'));
    const loc = c.locations.find((l) => l.slug === params.get('location'))
      ?? c.locations.find((l) => den?.location_ids.includes(l.id))
      ?? c.locations[0];
    const svc = c.services.find((s) => s.slug === params.get('service'));
    setLocationId(loc?.id ?? '');
    setServiceId(svc && loc && dentistsFor(c, loc.id, svc.id).length ? svc.id : (notSure?.id ?? ''));
    if (den && loc && den.location_ids.includes(loc.id)) setDentistId(den.id);
    setReady(true);
  }, [c, params, ready, notSure]);

  const location = c?.locations.find((l) => l.id === locationId);
  const service = c?.services.find((s) => s.id === serviceId);
  const dentist = c?.dentists.find((d) => d.id === dentistId);
  const treatments = useMemo(
    () => (c && locationId ? c.services.filter((s) => s.slug !== NOT_SURE && dentistsFor(c, locationId, s.id).length) : []),
    [c, locationId],
  );

  const today = clinicDateKey();
  const lastDay = addDays(today, c?.settings.max_advance_days ?? 60);
  const canLoad = !!(locationId && serviceId && date);

  const slots = useQuery({
    queryKey: ['slots', locationId, serviceId, dentistId, date],
    queryFn: () => getAvailableSlots({ locationId, serviceId, dentistId, date }),
    enabled: canLoad,
  });
  const groups = useMemo(() => splitByPartOfDay(groupSlots(slots.data ?? [])), [slots.data]);
  const total = groups.morning.length + groups.afternoon.length + groups.evening.length;

  // A closed or full day: offer the next day with free times.
  const nextFree = useQuery({
    queryKey: ['dates', locationId, serviceId, dentistId, date, 'next'],
    queryFn: () => getAvailableDates({
      locationId, serviceId, dentistId,
      from: addDays(date, 1), to: addDays(date, 14) < lastDay ? addDays(date, 14) : lastDay,
    }),
    enabled: canLoad && slots.isSuccess && total === 0 && date < lastDay,
  });
  const nextDay = nextFree.data?.find((d) => d.slot_count > 0)?.day.slice(0, 10);

  // Anything that changes which times exist clears the chosen time.
  const change = (fn: () => void) => {
    fn();
    setSlot(undefined);
    setNotice(null);
  };

  // ---- submit ----------------------------------------------------------------
  const form = useForm<Details>({ resolver: zodResolver(schema), defaultValues: { fullName: '', phone: '', notes: '' } });
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const mutation = useMutation({
    mutationFn: createBooking,
    onSuccess: (res, vars) => {
      setResult({ res, phone: vars.phone });
      requestAnimationFrame(() => {
        doneRef.current?.focus();
        doneRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : 'SERVER_ERROR';
      setCaptcha(null);
      setCaptchaKey((k) => k + 1); // a Turnstile token is single-use
      if (code === 'SLOT_UNAVAILABLE') {
        void qc.invalidateQueries({ queryKey: ['slots'] });
        setSlot(undefined);
        setNotice(t('booking.errors.SLOT_UNAVAILABLE'));
        timesRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      if (code === 'INVALID_NAME' || (code === 'VALIDATION' && JSON.stringify((e as ApiError).details ?? '').includes('fullName'))) {
        form.setError('fullName', { message: 'nameInvalid' });
        return;
      }
      const known = ['TOO_MANY_ACTIVE_BOOKINGS', 'RATE_LIMITED', 'TURNSTILE_FAILED', 'INVALID_PHONE', 'UNSUPPORTED_NETWORK', 'NETWORK'];
      setSubmitError(t(known.includes(code) ? `booking.errors.${code}` : 'booking.errors.generic'));
    },
  });

  const onSubmit = form.handleSubmit(
    (v) => {
      setSubmitError(null);
      if (!slot) {
        setSlotError(true);
        timesRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      if (!captcha) {
        setSubmitError(t('booking.errors.captcha'));
        return;
      }
      const phone = normalizeEthiopianPhone(v.phone);
      if (!phone.ok || !locationId || !serviceId) return;
      mutation.mutate({
        locationId,
        serviceId,
        dentistId,
        startsAt: slot.startsAt,
        fullName: v.fullName,
        phone: phone.e164,
        notes: v.notes || undefined,
        turnstileToken: captcha,
        website: v.website || undefined,
      });
    },
    () => setSlotError(!slot),
  );

  // ---- render ----------------------------------------------------------------
  if (catalog.isLoading || (c && !ready)) {
    return <p className="text-center text-ink-soft" aria-live="polite">{t('booking.loading')}</p>;
  }
  if (catalog.isError || !c) return <ErrorLine onRetry={() => catalog.refetch()} />;

  if (result) {
    const confirmed = result.res.appointment.status === 'confirmed';
    const bookedDentist = c.dentists.find((d) => d.id === result.res.appointment.dentistId);
    const at = result.res.appointment.startsAt;
    return (
      <section aria-labelledby="done-h" className="mx-auto max-w-[35rem]">
        <span className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-sky to-roha-700 text-white shadow-[0_10px_24px_-12px_rgb(22_52_114/0.7)]" aria-hidden="true">
          <Icon name="check" className="size-7" />
        </span>
        <h2 id="done-h" ref={doneRef} tabIndex={-1} className="mt-6 scroll-mt-32 text-h2 outline-none">
          {t(confirmed ? 'booking.done.confirmedTitle' : 'booking.done.pendingTitle')}
        </h2>
        <p className="mt-3 text-lede text-ink-soft">
          {t(confirmed ? 'booking.done.confirmedBody' : 'booking.done.pendingBody', { phone: formatEthiopianPhone(result.phone) })}
        </p>
        <dl className="mt-8 grid gap-4 rounded-card bg-page p-6 ring-1 ring-line sm:grid-cols-2">
          <Fact label={t('booking.steps.time')}>
            {formatClinicDate(at)}, {formatClinicTime(at)}
            <span className="block text-sm font-medium text-ink-soft">{ethiopianTime(at, localLang)}</span>
          </Fact>
          <Fact label={t('booking.form.branch')}>{location?.city}</Fact>
          <Fact label={t('booking.form.treatment')}>{service?.slug === NOT_SURE ? t('booking.form.notSure') : service?.name}</Fact>
          <Fact label={t('booking.steps.dentist')}>{bookedDentist?.full_name}</Fact>
        </dl>
        <p className="mt-4 text-sm text-ink-soft">{t('booking.details.payNote')}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to={`/b/${result.res.manageToken}`} className="btn-primary">{t('booking.done.manage')}</Link>
          <button type="button" className="btn-ghost" onClick={() => window.location.assign('/book')}>
            {t('booking.done.another')}
          </button>
        </div>
        <p className="mt-3 text-sm text-ink-soft">{t('booking.done.manageHint')}</p>
      </section>
    );
  }

  const err = form.formState.errors;
  return (
    <form onSubmit={onSubmit} noValidate className="relative mx-auto grid max-w-[35rem] gap-x-6.5 gap-y-6 sm:grid-cols-2">
      <Fld id="fullName" label={t('booking.details.name')}
        error={err.fullName?.message && t(`booking.errors.${err.fullName.message}`)}>
        <input id="fullName" autoComplete="name" maxLength={100} placeholder={t('booking.form.namePlaceholder')} className="fld"
          aria-invalid={!!err.fullName} aria-describedby={err.fullName ? 'fullName-error' : undefined} {...form.register('fullName')} />
      </Fld>
      <Fld id="phone" label={t('booking.details.phone')}
        error={err.phone?.message && t(`booking.errors.${err.phone.message}`)}>
        <input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxx" maxLength={20}
          className="fld tabular-nums" aria-invalid={!!err.phone} aria-describedby={err.phone ? 'phone-error' : undefined}
          {...form.register('phone')} />
      </Fld>

      <Fld id="service" label={t('booking.form.treatment')}>
        <select id="service" className="fld" value={serviceId}
          onChange={(e) => change(() => setServiceId(e.target.value))}>
          {!notSure && <option value="" disabled>{t('booking.form.pickTreatment')}</option>}
          {notSure && <option value={notSure.id}>{t('booking.form.notSure')}</option>}
          {treatments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Fld>
      <Fld id="branch" label={t('booking.form.branch')}>
        <select id="branch" className="fld" value={locationId}
          onChange={(e) => change(() => {
            const id = e.target.value;
            setLocationId(id);
            if (serviceId && !dentistsFor(c, id, serviceId).length) setServiceId(notSure?.id ?? '');
            if (dentist && !dentist.location_ids.includes(id)) setDentistId(null);
          })}>
          {c.locations.map((l) => <option key={l.id} value={l.id}>{l.city}</option>)}
        </select>
      </Fld>

      <Fld id="date" label={t('booking.form.date')} className="sm:col-span-2">
        <input id="date" type="date" className="fld" min={today} max={lastDay} value={date} required
          onChange={(e) => change(() => setDate(e.target.value))} />
      </Fld>

      {dentist && (
        <p className="-mt-2 text-sm text-ink-soft sm:col-span-2">
          {t('booking.form.with', { name: dentist.full_name })}{' '}
          <button type="button" className="link text-sm" onClick={() => change(() => setDentistId(null))}>
            {t('booking.dentist.any')}
          </button>
        </p>
      )}

      {/* Times for the chosen day */}
      <div ref={timesRef} className="scroll-mt-28 sm:col-span-2" aria-live="polite">
        {date && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <p className="text-xs text-subtle">{t('booking.form.time')}</p>
            {notice && <p role="alert" className="mt-2 rounded-lg border border-adey bg-adey-soft px-4 py-3 font-medium text-roha-900">{notice}</p>}
            {!canLoad ? (
              <p className="mt-2 text-ink-soft">{t('booking.form.pickTreatment')}</p>
            ) : slots.isLoading ? (
              <TimesSkeleton />
            ) : slots.isError ? (
              <ErrorLine onRetry={() => slots.refetch()} />
            ) : total === 0 ? (
              <div className="mt-2 text-ink-soft">
                <p>{t('booking.time.noSlots', { phone: location?.phone ?? '' })}</p>
                {nextDay && (
                  <button type="button" className="btn-ghost mt-3 min-h-10 px-4 text-sm"
                    onClick={() => change(() => setDate(nextDay))}>
                    {t('booking.form.nextFree', { day: formatClinicDate(`${nextDay}T12:00:00+03:00`, 'en-GB', false) })}
                  </button>
                )}
              </div>
            ) : (
              (['morning', 'afternoon', 'evening'] as const).map((part) =>
                groups[part].length ? (
                  <fieldset key={part} className="mt-3">
                    <legend className="text-sm font-medium text-ink">{t(`booking.time.${part}`)}</legend>
                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {groups[part].map((o) => {
                        const on = slot?.startsAt === o.startsAt;
                        return (
                          <button key={o.startsAt} type="button" aria-pressed={on}
                            onClick={() => { setSlot(o); setSlotError(false); setNotice(null); }}
                            className={`flex min-h-13 flex-col items-center justify-center rounded-full border leading-tight tabular-nums transition-[background-color,border-color,color,transform] duration-300 active:scale-[0.97] ${
                              on
                                ? 'border-transparent bg-[linear-gradient(100deg,var(--color-sky),var(--color-roha-700)_85%)] text-white shadow-[0_10px_24px_-14px_rgb(22_52_114/0.8)]'
                                : 'border-line bg-white text-ink hover:border-sky'
                            }`}>
                            <span className="text-[0.9375rem] font-medium">{formatClinicTime(o.startsAt)}</span>
                            <span className={`text-[0.6875rem] ${on ? 'text-white/80' : 'text-subtle'}`}>{ethiopianTime(o.startsAt, localLang)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ) : null,
              )
            )}
          </div>
        )}
        {slotError && !slot && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-800">
            {t(date ? 'booking.form.pickTime' : 'booking.form.pickDate')}
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        {showNotes ? (
          <Fld id="notes" label={t('booking.details.notes')}>
            <textarea id="notes" rows={2} maxLength={500} className="fld resize-none" autoFocus
              placeholder={t('booking.details.notesHint')} {...form.register('notes')} />
          </Fld>
        ) : (
          <button type="button" onClick={() => setShowNotes(true)} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-roha-700 hover:underline">
            <Icon name="plus" className="size-4" /> {t('booking.details.addNote')}
          </button>
        )}
      </div>

      {/* Honeypot — hidden from people and screen readers */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" {...form.register('website')} />
      </div>

      <div className="sm:col-span-2" aria-label={t('booking.details.captcha')}>
        <Turnstile key={captchaKey} onToken={setCaptcha} />
      </div>

      {submitError && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900 sm:col-span-2">{submitError}</p>
      )}

      <div className="flex flex-wrap items-center gap-5 sm:col-span-2">
        <button type="submit" className="btn-primary pl-2" disabled={mutation.isPending}>
          <span className="btn-ic bg-white/20 text-white"><ArrowRight className="size-4" /></span>
          {mutation.isPending ? t('booking.details.submitting') : t('booking.form.send')}
        </button>
        <small className="max-w-[30ch] text-xs text-subtle">{t('booking.details.payNote')}</small>
      </div>
    </form>
  );
}

// ---- small pieces ------------------------------------------------------------

function Fld({ id, label, error, className = '', children }: {
  id: string; label: string; error?: string | false; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`grid min-w-0 content-start gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs text-subtle">{label}</label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-sm font-medium text-red-800">{error}</p>}
    </div>
  );
}

function TimesSkeleton() {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => <span key={i} className="h-13 animate-pulse rounded-full bg-mist" />)}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="font-semibold text-roha-900">{children}</dd>
    </div>
  );
}
