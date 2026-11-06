import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { normalizeEthiopianPhone, formatEthiopianPhone } from '@shared/phone.ts';
import { isAllowedName } from '@shared/schemas.ts';
import { ethiopianTime, formatClinicDate, formatClinicTime, type TimeOption } from '@shared/time.ts';
import { ApiError, createBooking, getCatalog, type BookingResult, type Catalog } from '../../lib/api';
import { Icon } from '../../components/Icon';
import { TimePicker, ErrorLine } from './TimePicker';
import { Turnstile } from './Turnstile';

// Three steps: what & where → when (with an optional dentist filter) → who.
const STEPS = ['choose', 'time', 'details'] as const;
type Step = (typeof STEPS)[number] | 'done';

type Draft = {
  locationId?: string;
  serviceId?: string;
  dentistId: string | 'any';
  date?: string;
  slot?: TimeOption;
};

const detailsSchema = z.object({
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
type Details = z.infer<typeof detailsSchema>;

/** Dentists who offer a service at a location (from the catalog). */
const dentistsFor = (c: Catalog, locationId?: string, serviceId?: string) =>
  c.dentists.filter(
    (d) => (!locationId || d.location_ids.includes(locationId)) && (!serviceId || d.service_ids.includes(serviceId)),
  );

export default function BookingWizard() {
  const { t, i18n } = useTranslation();
  const localLang = i18n.language?.startsWith('am') ? 'am' : 'en';
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog, staleTime: 5 * 60_000 });

  const [draft, setDraft] = useState<Draft>({ dentistId: 'any' });
  const [step, setStep] = useState<Step>('choose');
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<{ res: BookingResult; phone: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Pre-select from ?location=&service=&dentist= (slugs); a single clinic is chosen automatically.
  useEffect(() => {
    const c = catalog.data;
    if (!c || ready) return;
    const loc = c.locations.find((l) => l.slug === params.get('location'));
    const svc = c.services.find((s) => s.slug === params.get('service'));
    const den = c.dentists.find((d) => d.slug === params.get('dentist'));
    const next: Draft = { dentistId: 'any' };
    next.locationId = loc?.id ?? (den?.location_ids.length === 1 ? den.location_ids[0] : c.locations.length === 1 ? c.locations[0].id : undefined);
    if (svc && (!next.locationId || dentistsFor(c, next.locationId, svc.id).length)) next.serviceId = svc.id;
    if (den && (!next.locationId || den.location_ids.includes(next.locationId))) next.dentistId = den.id;
    setDraft(next);
    setStep(next.locationId && next.serviceId ? 'time' : 'choose');
    setReady(true);
  }, [catalog.data, params, ready]);

  const goto = (s: Step) => {
    setStep(s);
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  const c = catalog.data;
  const location = c?.locations.find((l) => l.id === draft.locationId);
  const service = c?.services.find((s) => s.id === draft.serviceId);
  const dentist = c?.dentists.find((d) => d.id === draft.dentistId);
  const servicesHere = useMemo(
    () => (c && draft.locationId ? c.services.filter((s) => dentistsFor(c, draft.locationId, s.id).length) : []),
    [c, draft.locationId],
  );
  const dentistsHere = useMemo(
    () => (c ? dentistsFor(c, draft.locationId, draft.serviceId) : []),
    [c, draft.locationId, draft.serviceId],
  );
  const when = (slot: TimeOption) =>
    `${formatClinicDate(slot.startsAt, 'en-GB', false)}, ${formatClinicTime(slot.startsAt)} (${ethiopianTime(slot.startsAt, localLang)})`;

  // ---- details form --------------------------------------------------------
  const form = useForm<Details>({ resolver: zodResolver(detailsSchema), defaultValues: { fullName: '', phone: '', notes: '' } });
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createBooking,
    onSuccess: (res, vars) => {
      setResult({ res, phone: vars.phone });
      goto('done');
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : 'SERVER_ERROR';
      setCaptcha(null);
      setCaptchaKey((k) => k + 1); // a Turnstile token is single-use
      if (code === 'SLOT_UNAVAILABLE') {
        void qc.invalidateQueries({ queryKey: ['slots'] });
        void qc.invalidateQueries({ queryKey: ['dates'] });
        setDraft((d) => ({ ...d, slot: undefined }));
        setNotice(t('booking.errors.SLOT_UNAVAILABLE'));
        goto('time');
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

  const onSubmit = form.handleSubmit((v) => {
    setSubmitError(null);
    if (!captcha) {
      setSubmitError(t('booking.errors.captcha'));
      return;
    }
    const phone = normalizeEthiopianPhone(v.phone);
    if (!phone.ok || !draft.locationId || !draft.serviceId || !draft.slot) return;
    mutation.mutate({
      locationId: draft.locationId,
      serviceId: draft.serviceId,
      dentistId: draft.dentistId === 'any' ? null : draft.dentistId,
      startsAt: draft.slot.startsAt,
      fullName: v.fullName,
      phone: phone.e164,
      notes: v.notes || undefined,
      turnstileToken: captcha,
      website: v.website || undefined,
    });
  });

  // ---- render --------------------------------------------------------------
  if (catalog.isLoading || (c && !ready)) {
    return <p className="text-ink-soft" aria-live="polite">{t('booking.loading')}</p>;
  }
  if (catalog.isError || !c) return <ErrorLine onRetry={() => catalog.refetch()} />;

  if (step === 'done' && result) {
    const confirmed = result.res.appointment.status === 'confirmed';
    const bookedDentist = c.dentists.find((d) => d.id === result.res.appointment.dentistId);
    const at = result.res.appointment.startsAt;
    return (
      <section aria-labelledby="done-h" className="max-w-2xl">
        <span className="step-cross flex size-14 items-center justify-center bg-roha-700 text-adey" aria-hidden="true">
          <Icon name="check" className="size-7" />
        </span>
        <h2 id="done-h" ref={headingRef} tabIndex={-1} className="mt-6 text-h2 outline-none">
          {t(confirmed ? 'booking.done.confirmedTitle' : 'booking.done.pendingTitle')}
        </h2>
        <p className="mt-3 text-lede text-ink-soft">
          {t(confirmed ? 'booking.done.confirmedBody' : 'booking.done.pendingBody', { phone: formatEthiopianPhone(result.phone) })}
        </p>
        <dl className="step-corner mt-8 grid gap-4 bg-white p-6 ring-1 ring-line sm:grid-cols-2">
          <Fact label={t('booking.steps.time')}>
            {formatClinicDate(at)}, {formatClinicTime(at)}
            <span className="block text-sm font-medium text-ink-soft">{ethiopianTime(at, localLang)}</span>
          </Fact>
          <Fact label={t('booking.steps.location')}>{location?.city}</Fact>
          <Fact label={t('booking.steps.service')}>{service?.name}</Fact>
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

  const stepIndex = STEPS.indexOf(step as (typeof STEPS)[number]);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-roha-600">{t('booking.stepOf', { step: stepIndex + 1, total: STEPS.length })}</p>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-roha-700' : 'bg-mist'}`} />
          ))}
        </div>

        {notice && (
          <p role="alert" className="mt-6 rounded-lg border border-adey bg-adey-soft px-4 py-3 font-medium text-roha-900">{notice}</p>
        )}

        {step === 'choose' && (
          <StepShell title={t('booking.choose.title')} headingRef={headingRef}>
            {c.locations.length > 1 && (
              <>
                <h3 className="mb-3 text-lg font-bold text-roha-900">{t('booking.choose.clinic')}</h3>
                <Choices
                  items={c.locations.map((l) => ({ id: l.id, title: l.city, body: l.phone }))}
                  selected={draft.locationId}
                  onSelect={(id) => {
                    const keepService = draft.serviceId && dentistsFor(c, id, draft.serviceId).length;
                    setDraft({ locationId: id, serviceId: keepService ? draft.serviceId : undefined, dentistId: 'any' });
                  }}
                />
              </>
            )}
            <h3 className={`mb-1 text-lg font-bold text-roha-900 ${c.locations.length > 1 ? 'mt-8' : ''}`}>{t('booking.choose.treatment')}</h3>
            {!draft.locationId ? (
              <p className="text-ink-soft">{t('booking.choose.pickClinic')}</p>
            ) : (
              <>
                <p className="mb-3 text-ink-soft">{t('booking.service.hint')}</p>
                <Choices
                  items={servicesHere.map((s) => ({
                    id: s.id, title: s.name, body: s.summary ?? '', meta: t('common.minutes', { count: s.duration_minutes }),
                  }))}
                  selected={draft.serviceId}
                  onSelect={(id) => {
                    setDraft((d) => ({ ...d, serviceId: id, dentistId: 'any', date: undefined, slot: undefined }));
                    goto('time');
                  }}
                />
              </>
            )}
          </StepShell>
        )}

        {step === 'time' && draft.locationId && draft.serviceId && (
          <StepShell title={t('booking.time.title')} headingRef={headingRef} onBack={() => goto('choose')}>
            {dentistsHere.length === 0 ? (
              <p className="text-ink-soft">{t('booking.dentist.none')}</p>
            ) : (
              <>
                {dentistsHere.length > 1 && (
                  <label className="mb-6 flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-roha-900">{t('booking.time.dentist')}</span>
                    <select className="input w-auto min-w-64 py-2.5" value={draft.dentistId}
                      onChange={(e) => setDraft((d) => ({ ...d, dentistId: e.target.value, date: undefined, slot: undefined }))}>
                      <option value="any">{t('booking.dentist.any')} — {t('booking.dentist.anyHint').toLowerCase()}</option>
                      {dentistsHere.map((d) => <option key={d.id} value={d.id}>{d.full_name}{d.title ? ` · ${d.title}` : ''}</option>)}
                    </select>
                  </label>
                )}
                <TimePicker
                  key={draft.dentistId}
                  locationId={draft.locationId}
                  serviceId={draft.serviceId}
                  dentistId={draft.dentistId === 'any' ? null : draft.dentistId}
                  maxAdvanceDays={c.settings.max_advance_days}
                  clinicPhone={location?.phone ?? ''}
                  date={draft.date}
                  onDate={(date) => setDraft((d) => ({ ...d, date, slot: undefined }))}
                  value={draft.slot}
                  onChange={(slot) => {
                    setNotice(null);
                    setDraft((d) => ({ ...d, slot }));
                    goto('details');
                  }}
                />
              </>
            )}
          </StepShell>
        )}

        {step === 'details' && draft.slot && (
          <StepShell title={t('booking.details.title')} headingRef={headingRef} onBack={() => goto('time')}>
            {/* What they are booking — always above the button, also on phones */}
            <div className="step-corner mb-8 max-w-xl bg-mist p-5">
              <p className="text-sm font-semibold text-ink-soft">{t('booking.details.check')}</p>
              <p className="mt-1 text-lg font-bold text-roha-900">{when(draft.slot)}</p>
              <p className="text-roha-900">
                {service?.name} · {location?.city} · {draft.dentistId === 'any' ? t('booking.dentist.any') : dentist?.full_name}
              </p>
              <button type="button" onClick={() => goto('time')} className="mt-2 text-sm font-semibold text-roha-600 hover:underline">
                {t('booking.change')}
              </button>
            </div>

            <form onSubmit={onSubmit} noValidate className="max-w-xl space-y-5">
              <Field id="fullName" label={t('booking.details.name')} hint={t('booking.details.nameHint')}
                error={form.formState.errors.fullName?.message && t(`booking.errors.${form.formState.errors.fullName.message}`)}>
                <input id="fullName" autoComplete="name" maxLength={100} className="input" aria-invalid={!!form.formState.errors.fullName}
                  aria-describedby={`fullName-hint${form.formState.errors.fullName ? ' fullName-error' : ''}`} {...form.register('fullName')} />
              </Field>
              <Field id="phone" label={t('booking.details.phone')} hint={t('booking.details.phoneHint')}
                error={form.formState.errors.phone?.message && t(`booking.errors.${form.formState.errors.phone.message}`)}>
                <input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0911 234 567" maxLength={20}
                  className="input tabular-nums" aria-invalid={!!form.formState.errors.phone}
                  aria-describedby={`phone-hint${form.formState.errors.phone ? ' phone-error' : ''}`} {...form.register('phone')} />
              </Field>
              <Field id="notes" label={t('booking.details.notes')} hint={t('booking.details.notesHint')}>
                <textarea id="notes" aria-describedby="notes-hint" rows={3} maxLength={500} className="input" {...form.register('notes')} />
              </Field>
              {/* Honeypot — hidden from people and screen readers */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
                <label htmlFor="website">Website</label>
                <input id="website" tabIndex={-1} autoComplete="off" {...form.register('website')} />
              </div>

              <div aria-label={t('booking.details.captcha')}>
                <Turnstile key={captchaKey} onToken={setCaptcha} />
              </div>

              {submitError && (
                <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900">{submitError}</p>
              )}

              <button type="submit" className="btn-primary w-full text-lg sm:w-auto sm:px-8" disabled={mutation.isPending}>
                {mutation.isPending ? t('booking.details.submitting') : t('booking.details.submit')}
              </button>
              <p className="text-sm text-ink-soft">{t('booking.details.payNote')}</p>
            </form>
          </StepShell>
        )}
      </div>

      {/* Running summary (desktop only — on phones the details step shows it above the form) */}
      <aside className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
        <div className="step-corner bg-mist p-5">
          <h2 className="font-bold text-roha-900">{t('booking.details.summary')}</h2>
          <dl className="mt-3 divide-y divide-roha-200">
            <SummaryRow label={t('booking.steps.location')} value={location?.city} onChange={() => goto('choose')} />
            <SummaryRow label={t('booking.steps.service')} value={step !== 'choose' ? service?.name : undefined} onChange={() => goto('choose')} />
            <SummaryRow label={t('booking.steps.dentist')}
              value={step !== 'choose' ? (draft.dentistId === 'any' ? t('booking.dentist.any') : dentist?.full_name) : undefined}
              onChange={() => goto('time')} />
            <SummaryRow label={t('booking.steps.time')} value={draft.slot && step === 'details' ? when(draft.slot) : undefined}
              onChange={() => goto('time')} />
          </dl>
        </div>
      </aside>
    </div>
  );
}

// ---- small pieces ------------------------------------------------------------

function StepShell(props: {
  title: string; children: React.ReactNode; onBack?: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();
  return (
    <section className="mt-6 scroll-mt-24">
      {props.onBack && (
        <button type="button" onClick={props.onBack} className="mb-3 text-sm font-semibold text-roha-600 hover:underline">
          ‹ {t('booking.back')}
        </button>
      )}
      <h2 ref={props.headingRef} tabIndex={-1} className="text-h2 outline-none">{props.title}</h2>
      <div className="mt-6">{props.children}</div>
    </section>
  );
}

function Choices({ items, selected, onSelect }: {
  items: { id: string; title: string; body?: string; meta?: string }[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((i) => {
        const on = i.id === selected;
        return (
          <li key={i.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(i.id)}
              className={`flex h-full w-full items-start justify-between gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                on ? 'border-roha-700 bg-roha-50' : 'border-line bg-white hover:border-roha-300'
              }`}
            >
              <span>
                <span className="block text-lg font-bold text-roha-900">{i.title}</span>
                {i.body && <span className="mt-1 block text-ink-soft">{i.body}</span>}
              </span>
              {i.meta && <span className="shrink-0 text-sm font-semibold text-roha-600">{i.meta}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Field({ id, label, hint, error, children }: {
  id: string; label: string; hint?: string; error?: string | false; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-semibold text-roha-900">{label}</label>
      {hint && <p id={`${id}-hint`} className="text-sm text-ink-soft">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-red-800">{error}</p>}
    </div>
  );
}

function SummaryRow({ label, value, onChange }: { label: string; value?: string; onChange: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div>
        <dt className="text-xs font-semibold text-ink-soft">{label}</dt>
        <dd className={value ? 'font-semibold text-roha-900' : 'text-ink-soft/70'}>{value ?? '—'}</dd>
      </div>
      {value && (
        <button type="button" onClick={onChange} className="text-sm font-semibold text-roha-600 hover:underline">
          {t('booking.change')}
        </button>
      )}
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
