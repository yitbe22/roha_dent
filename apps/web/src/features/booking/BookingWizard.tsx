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
const STEP_LABEL = { choose: 'booking.steps.service', time: 'booking.steps.time', details: 'booking.steps.details' } as const;

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
  const [showNotes, setShowNotes] = useState(false);

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
        <span className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-sky to-roha-700 text-white shadow-[0_10px_24px_-12px_rgb(22_52_114/0.7)]" aria-hidden="true">
          <Icon name="check" className="size-7" />
        </span>
        <h2 id="done-h" ref={headingRef} tabIndex={-1} className="mt-6 scroll-mt-32 text-h2 outline-none">
          {t(confirmed ? 'booking.done.confirmedTitle' : 'booking.done.pendingTitle')}
        </h2>
        <p className="mt-3 text-lede text-ink-soft">
          {t(confirmed ? 'booking.done.confirmedBody' : 'booking.done.pendingBody', { phone: formatEthiopianPhone(result.phone) })}
        </p>
        <dl className="rounded-card mt-8 grid gap-4 bg-white p-6 ring-1 ring-line sm:grid-cols-2">
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
    <div className="max-w-3xl">
      <div className="min-w-0">
        <p className="sr-only">{t('booking.stepOf', { step: stepIndex + 1, total: STEPS.length })}</p>
        <ol className="grid grid-cols-3 gap-2" aria-hidden="true">
          {STEPS.map((s, i) => (
            <li key={s} className={`text-sm ${i === stepIndex ? 'font-medium text-roha-700' : i < stepIndex ? 'text-roha-600' : 'text-muted'}`}>
              <span className={`mb-2 block h-1 rounded-full transition-colors duration-500 ${i <= stepIndex ? 'bg-gradient-to-r from-sky to-roha-700' : 'bg-mist'}`} />
              {t(STEP_LABEL[s])}
            </li>
          ))}
        </ol>

        {notice && (
          <p role="alert" className="mt-6 rounded-lg border border-adey bg-adey-soft px-4 py-3 font-medium text-roha-900">{notice}</p>
        )}

        {step === 'choose' && (
          <StepShell title={t('booking.choose.title')} headingRef={headingRef}>
            {c.locations.length > 1 && (
              <>
                <h3 className="mb-3 font-display text-lg font-medium text-ink">{t('booking.choose.clinic')}</h3>
                <Pills
                  items={c.locations.map((l) => ({ id: l.id, title: l.city }))}
                  selected={draft.locationId}
                  onSelect={(id) => {
                    const keepService = draft.serviceId && dentistsFor(c, id, draft.serviceId).length;
                    setDraft({ locationId: id, serviceId: keepService ? draft.serviceId : undefined, dentistId: 'any' });
                  }}
                />
              </>
            )}
            <h3 className={`mb-3 font-display text-lg font-medium text-ink ${c.locations.length > 1 ? 'mt-9' : ''}`}>{t('booking.choose.treatment')}</h3>
            {!draft.locationId ? (
              <p className="text-ink-soft">{t('booking.choose.pickClinic')}</p>
            ) : (
              <>
                <Choices
                  items={servicesHere.map((s) => ({
                    id: s.id, title: s.name, meta: t('common.minutes', { count: s.duration_minutes }),
                  }))}
                  selected={draft.serviceId}
                  onSelect={(id) => {
                    setDraft((d) => ({ ...d, serviceId: id, dentistId: 'any', date: undefined, slot: undefined }));
                    goto('time');
                  }}
                />
                <p className="mt-4 text-sm">{t('booking.service.hint')}</p>
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
                <Picked onChange={() => goto('choose')}>{service?.name} · {location?.city}</Picked>
                {dentistsHere.length > 1 && (
                  <label className="mb-6 flex flex-wrap items-center gap-3">
                    <span className="font-medium text-ink">{t('booking.time.dentist')}</span>
                    <select className="input w-full py-2.5 sm:w-auto sm:min-w-64" value={draft.dentistId}
                      onChange={(e) => setDraft((d) => ({ ...d, dentistId: e.target.value, date: undefined, slot: undefined }))}>
                      <option value="any">{t('booking.dentist.any')}</option>
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
            <div className="mb-8 flex max-w-xl items-start justify-between gap-4 rounded-card bg-page p-5 ring-1 ring-line">
              <div>
                <p className="font-display text-lg font-medium text-ink">{when(draft.slot)}</p>
                <p className="mt-1 text-[0.9375rem]">
                  {service?.name} · {location?.city} · {draft.dentistId === 'any' ? t('booking.dentist.any') : dentist?.full_name}
                </p>
              </div>
              <button type="button" onClick={() => goto('time')} className="link shrink-0 text-sm">
                {t('booking.change')}
              </button>
            </div>

            <form onSubmit={onSubmit} noValidate className="max-w-xl space-y-5">
              <Field id="fullName" label={t('booking.details.name')}
                error={form.formState.errors.fullName?.message && t(`booking.errors.${form.formState.errors.fullName.message}`)}>
                <input id="fullName" autoComplete="name" maxLength={100} className="input" aria-invalid={!!form.formState.errors.fullName}
                  aria-describedby={form.formState.errors.fullName ? 'fullName-error' : undefined} {...form.register('fullName')} />
              </Field>
              <Field id="phone" label={t('booking.details.phone')} hint={t('booking.details.phoneHint')}
                error={form.formState.errors.phone?.message && t(`booking.errors.${form.formState.errors.phone.message}`)}>
                <input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0911 234 567" maxLength={20}
                  className="input tabular-nums" aria-invalid={!!form.formState.errors.phone}
                  aria-describedby={`phone-hint${form.formState.errors.phone ? ' phone-error' : ''}`} {...form.register('phone')} />
              </Field>
              {showNotes ? (
                <Field id="notes" label={t('booking.details.notes')} hint={t('booking.details.notesHint')}>
                  <textarea id="notes" aria-describedby="notes-hint" rows={3} maxLength={500} className="input" autoFocus {...form.register('notes')} />
                </Field>
              ) : (
                <button type="button" onClick={() => setShowNotes(true)} className="inline-flex min-h-11 items-center gap-2 text-[0.9375rem] font-medium text-roha-700 hover:underline">
                  <Icon name="plus" className="size-4" /> {t('booking.details.addNote')}
                </button>
              )}
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

              <button type="submit" className="btn-primary w-full text-[1.0625rem] sm:w-auto sm:px-10" disabled={mutation.isPending}>
                {mutation.isPending ? t('booking.details.submitting') : t('booking.details.submit')}
              </button>
              <p className="text-sm text-ink-soft">{t('booking.details.payNote')}</p>
            </form>
          </StepShell>
        )}
      </div>

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
    <section className="mt-9 scroll-mt-24">
      {props.onBack && (
        <button type="button" onClick={props.onBack} className="mb-3 text-sm font-medium text-roha-600 hover:underline">
          ‹ {t('booking.back')}
        </button>
      )}
      <h2 ref={props.headingRef} tabIndex={-1} className="scroll-mt-32 font-display text-[clamp(1.625rem,3vw,2.25rem)] leading-tight outline-none">{props.title}</h2>
      <div className="mt-6">{props.children}</div>
    </section>
  );
}

/** Treatments: one compact row each (name + length). */
function Choices({ items, selected, onSelect }: {
  items: { id: string; title: string; meta?: string }[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((i) => {
        const on = i.id === selected;
        return (
          <li key={i.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(i.id)}
              className={`flex min-h-14 w-full items-center justify-between gap-4 rounded-card border px-4 py-3 text-left transition-colors ${
                on ? 'border-roha-700 bg-roha-50 ring-1 ring-roha-700' : 'border-line bg-white hover:border-sky'
              }`}
            >
              <span className="font-medium text-ink">{i.title}</span>
              {i.meta && <span className="shrink-0 text-sm tabular-nums text-roha-600">{i.meta}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Clinics: a short row of pills. */
function Pills({ items, selected, onSelect }: {
  items: { id: string; title: string }[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => {
        const on = i.id === selected;
        return (
          <button
            key={i.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(i.id)}
            className={`inline-flex min-h-12 items-center gap-2 rounded-full border px-5 font-medium transition-colors ${
              on ? 'border-roha-700 bg-roha-700 text-white' : 'border-line bg-white text-ink hover:border-sky'
            }`}
          >
            {on && <Icon name="check" className="size-4" />}
            {i.title}
          </button>
        );
      })}
    </div>
  );
}

/** One line recalling an earlier choice, with a way back. */
function Picked({ children, onChange }: { children: React.ReactNode; onChange: () => void }) {
  const { t } = useTranslation();
  return (
    <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-page px-4 py-2.5 text-[0.9375rem] text-ink ring-1 ring-line sm:inline-flex sm:rounded-full">
      <span>{children}</span>
      <button type="button" onClick={onChange} className="link text-sm">{t('booking.change')}</button>
    </p>
  );
}

function Field({ id, label, hint, error, children }: {
  id: string; label: string; hint?: string; error?: string | false; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-medium text-ink">{label}</label>
      {hint && <p id={`${id}-hint`} className="text-sm text-ink-soft">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-red-800">{error}</p>}
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
