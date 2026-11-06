import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  addDays, clinicDateKey, ethiopianTime, formatClinicTime, groupSlots, splitByPartOfDay, weekdayOfKey, type TimeOption,
} from '@shared/time.ts';
import { getAvailableDates, getAvailableSlots } from '../../lib/api';

const PAGE = 14;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Props = {
  locationId: string;
  serviceId: string;
  dentistId: string | null;
  maxAdvanceDays: number;
  clinicPhone: string;
  date: string | undefined;
  onDate: (d: string) => void;
  value: TimeOption | undefined;
  onChange: (o: TimeOption) => void;
  /** Hide this start time (e.g. the appointment being rescheduled). */
  excludeStart?: string;
};

export function TimePicker(p: Props) {
  const { t, i18n } = useTranslation();
  const localLang = i18n.language?.startsWith('am') ? 'am' : 'en';
  const today = clinicDateKey();
  const lastDay = addDays(today, p.maxAdvanceDays);
  const [page, setPage] = useState(0);
  const from = addDays(today, page * PAGE);
  const to = addDays(from, PAGE - 1) < lastDay ? addDays(from, PAGE - 1) : lastDay;

  const days = useQuery({
    queryKey: ['dates', p.locationId, p.serviceId, p.dentistId, from, to],
    queryFn: () => getAvailableDates({ locationId: p.locationId, serviceId: p.serviceId, dentistId: p.dentistId, from, to }),
  });

  const slots = useQuery({
    queryKey: ['slots', p.locationId, p.serviceId, p.dentistId, p.date],
    queryFn: () => getAvailableSlots({ locationId: p.locationId, serviceId: p.serviceId, dentistId: p.dentistId, date: p.date! }),
    enabled: !!p.date,
  });

  const groups = useMemo(() => {
    const opts = groupSlots(slots.data ?? []).filter((o) => o.startsAt !== p.excludeStart);
    return splitByPartOfDay(opts);
  }, [slots.data, p.excludeStart]);
  const total = groups.morning.length + groups.afternoon.length + groups.evening.length;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-ghost min-h-10 px-3 text-sm" disabled={page === 0}
          onClick={() => setPage((x) => x - 1)} aria-label={t('booking.time.earlier')}>
          ‹
        </button>
        <p className="text-sm font-semibold text-ink-soft" aria-live="polite">
          {fmtShort(from)} – {fmtShort(to)}
        </p>
        <button type="button" className="btn-ghost min-h-10 px-3 text-sm" disabled={to >= lastDay}
          onClick={() => setPage((x) => x + 1)} aria-label={t('booking.time.later')}>
          ›
        </button>
      </div>

      {days.isError ? (
        <ErrorLine onRetry={() => days.refetch()} />
      ) : (
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7" aria-busy={days.isLoading}>
          {(days.data ?? placeholderDays(from, to)).map((d) => {
            const key = d.day.slice(0, 10);
            const free = d.slot_count > 0;
            const selected = key === p.date;
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={!free || days.isLoading}
                  aria-pressed={selected}
                  onClick={() => p.onDate(key)}
                  className={`flex w-full flex-col items-center rounded-lg border px-1 py-2 text-center transition-colors ${
                    selected
                      ? 'border-roha-700 bg-roha-700 text-white'
                      : free
                        ? 'border-line bg-white hover:border-roha-500'
                        : 'border-transparent bg-mist/60 text-ink-soft/60'
                  } ${days.isLoading ? 'animate-pulse' : ''}`}
                >
                  <span className="text-xs font-medium">{WEEKDAY[weekdayOfKey(key)]}</span>
                  <span className="text-lg font-bold leading-tight">{Number(key.slice(8))}</span>
                  <span className="text-[0.7rem]">{free ? MONTH[Number(key.slice(5, 7)) - 1] : t('booking.time.dayFull')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {days.data && days.data.every((d) => d.slot_count === 0) && (
        <p className="mt-3 text-ink-soft">{t('booking.time.noDays')}</p>
      )}

      <div className="mt-6" aria-live="polite">
        {!p.date ? (
          <p className="text-ink-soft">{t('booking.time.pickDay')}</p>
        ) : slots.isLoading ? (
          <p className="text-ink-soft">{t('booking.loading')}</p>
        ) : slots.isError ? (
          <ErrorLine onRetry={() => slots.refetch()} />
        ) : total === 0 ? (
          <p className="text-ink-soft">{t('booking.time.noSlots', { phone: p.clinicPhone })}</p>
        ) : (
          (['morning', 'afternoon', 'evening'] as const).map((part) =>
            groups[part].length ? (
              <fieldset key={part} className="mt-4 first:mt-0">
                <legend className="text-sm font-semibold text-ink-soft">{t(`booking.time.${part}`)}</legend>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {groups[part].map((o) => {
                    const selected = p.value?.startsAt === o.startsAt;
                    return (
                      <button
                        key={o.startsAt}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => p.onChange(o)}
                        className={`flex min-h-14 flex-col items-center justify-center rounded-lg border font-semibold leading-tight tabular-nums transition-colors ${
                          selected ? 'border-roha-700 bg-roha-700 text-white' : 'border-line bg-white text-roha-800 hover:border-roha-500'
                        }`}
                      >
                        <span>{formatClinicTime(o.startsAt)}</span>
                        <span className={`text-[0.7rem] font-medium ${selected ? 'text-roha-100' : 'text-ink-soft'}`}>
                          {ethiopianTime(o.startsAt, localLang)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null,
          )
        )}
      </div>
    </div>
  );
}

function fmtShort(key: string) {
  return `${Number(key.slice(8))} ${MONTH[Number(key.slice(5, 7)) - 1]}`;
}

function placeholderDays(from: string, to: string) {
  const out: { day: string; slot_count: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ day: d, slot_count: 0 });
  return out;
}

export function ErrorLine({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <p className="mt-3 flex flex-wrap items-center gap-3 text-red-800" role="alert">
      {t('booking.errors.loadFailed')}
      <button type="button" className="link" onClick={onRetry}>{t('booking.errors.retry')}</button>
    </p>
  );
}
