import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, clinicDateKey, clinicDayRange, ethiopianTime, formatClinicDate, formatClinicTime, formatEthiopianDate } from '@shared/time.ts';
import { supabase } from '../supabase';
import { useAuth } from '../auth';
import { errorMessage, useLookups, usePendingCount } from '../data';
import { APPOINTMENT_SELECT, SOURCE_LABEL, type Appointment } from '../types';
import { CallButton, Empty, ErrorBox, Loading, PageHeader, StatusBadge, btn, fmtRelative, useOpenAppointment, useToast } from '../ui';
import { DateNav, ScopeSelect } from './common';
import { Icon } from '../../components/Icon';

type View = 'day' | 'pending';

/** "Today", "Tomorrow", "Yesterday" or the date. */
export function dayName(key: string): string {
  const today = clinicDateKey();
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  return formatClinicDate(key, 'en-GB', false);
}

export default function AppointmentsPage() {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'pending' ? 'pending' : 'day';
  const date = params.get('date') ?? clinicDateKey();
  const showCancelled = params.get('cancelled') === '1';
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v === null) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };
  const pendingCount = usePendingCount(auth.scope).data ?? 0;

  const q = useQuery({
    queryKey: ['appointments', view, view === 'day' ? date : 'upcoming', auth.scope],
    queryFn: async () => {
      let query = supabase.from('appointments').select(APPOINTMENT_SELECT).order('starts_at');
      if (view === 'day') {
        const r = clinicDayRange(date);
        query = query.gte('starts_at', r.from).lt('starts_at', r.to);
      } else {
        query = query.eq('status', 'pending').gte('starts_at', new Date().toISOString()).limit(300);
      }
      if (auth.scope) query = query.eq('location_id', auth.scope);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Appointment[];
    },
  });

  const all = q.data ?? [];
  const cancelledCount = all.filter((a) => a.status === 'cancelled').length;
  const list = view === 'pending' || showCancelled ? all : all.filter((a) => a.status !== 'cancelled');
  const stats = useMemo(() => {
    const now = Date.now();
    const active = all.filter((a) => a.status !== 'cancelled');
    const next = active.find((a) => (a.status === 'confirmed' || a.status === 'pending') && new Date(a.ends_at).getTime() > now);
    return {
      total: active.length,
      visited: active.filter((a) => a.status === 'completed').length,
      toCome: active.filter((a) => (a.status === 'confirmed' || a.status === 'pending') && new Date(a.starts_at).getTime() > now).length,
      next,
    };
  }, [all]);
  const isToday = date === clinicDateKey();

  return (
    <>
      <PageHeader
        title={view === "day" ? dayName(date) : "Requests to confirm"}
        subtitle={view === 'day' ? <>{formatClinicDate(date)} <span className="text-roha-500">· {formatEthiopianDate(date)}</span></> : 'Booking requests from the website. Call each patient, then press Confirm.'}
        actions={<ScopeSelect />}
      />

      {/* tabs */}
      <div role="tablist" className="mb-5 flex flex-wrap gap-2">
        <Tab active={view === 'day'} onClick={() => set('view', null)} icon="calendar">Day list</Tab>
        <Tab active={view === 'pending'} onClick={() => set('view', 'pending')} icon="alert" badge={pendingCount}>Requests to confirm</Tab>
      </div>

      {view === 'day' && (
        <>
          {pendingCount > 0 && (
            <button type="button" onClick={() => set('view', 'pending')}
              className="mb-5 flex w-full items-center gap-3 rounded-xl border-2 border-adey bg-adey-soft px-4 py-3 text-left hover:bg-adey/40 sm:px-5 sm:py-4">
              <Icon name="alert" className="size-6 text-[#7a5300]" />
              <span className="flex-1 font-semibold text-roha-900 sm:text-lg">
                {pendingCount === 1 ? '1 booking request is' : `${pendingCount} booking requests are`} waiting for you to confirm
              </span>
              <span className="shrink-0 font-semibold text-roha-700">Show →</span>
            </button>
          )}

          <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label={isToday ? 'Patients today' : 'Patients this day'} value={String(stats.total)} />
            <Stat label="Still to come" value={String(stats.toCome)} />
            <Stat label="Next patient"
              value={stats.next ? formatClinicTime(stats.next.starts_at) : '—'}
              sub={stats.next ? `${ethiopianTime(stats.next.starts_at)} · ${stats.next.patient.full_name}` : isToday ? 'No more patients today' : undefined} />
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <DateNav value={date} onChange={(d) => set('date', d === clinicDateKey() ? null : d)} />
            {cancelledCount > 0 && (
              <label className="inline-flex items-center gap-2 text-ink-soft">
                <input type="checkbox" className="size-4 accent-roha-700" checked={showCancelled} onChange={(e) => set('cancelled', e.target.checked ? '1' : null)} />
                Show {cancelledCount} cancelled
              </label>
            )}
          </div>
        </>
      )}

      {q.isError ? (
        <ErrorBox error={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <Loading />
      ) : list.length === 0 ? (
        view === 'day' ? (
          <Empty icon="calendar">
            <p className="font-semibold text-ink">No appointments on this day.</p>
            <Link to="/admin/new" className="link mt-2 inline-block">Add a booking</Link>
          </Empty>
        ) : (
          <Empty><p className="font-semibold text-ink">All done — no requests are waiting.</p></Empty>
        )
      ) : (
        <AppointmentList items={list} showDate={view === 'pending'} highlightNext={view === 'day' ? stats.next?.id : undefined} showRequested={view === 'pending'} />
      )}
    </>
  );
}

function Tab({ active, onClick, children, icon, badge }: { active: boolean; onClick: () => void; children: string; icon: 'calendar' | 'alert'; badge?: number }) {
  return (
    <button role="tab" aria-selected={active} type="button" onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg border-2 px-4 font-semibold transition-colors ${
        active ? 'border-roha-700 bg-roha-700 text-white' : 'border-line bg-white text-roha-800 hover:border-roha-300'
      }`}>
      <Icon name={icon} className="size-5" />
      {children}
      {!!badge && <span className={`rounded-full px-2 text-sm font-bold ${active ? 'bg-adey text-roha-900' : 'bg-adey text-roha-900'}`}>{badge}</span>}
    </button>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-white px-3 py-3 sm:px-5 sm:py-4">
      <p className="text-xs text-ink-soft sm:text-sm">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-roha-900 sm:text-3xl">{value}</p>
      {sub && <p className="truncate text-sm text-ink-soft sm:text-base">{sub}</p>}
    </div>
  );
}

export function AppointmentList({ items, showDate, highlightNext, showRequested }: {
  items: Appointment[]; showDate?: boolean; highlightNext?: string; showRequested?: boolean;
}) {
  const auth = useAuth();
  const { data: lk } = useLookups();
  const open = useOpenAppointment();
  const toast = useToast();
  const qc = useQueryClient();
  const confirm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast('Confirmed. The patient gets a confirmation SMS.');
      for (const k of ['appointments', 'pending-count', 'appointment']) qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const now = Date.now();

  return (
    <ul className="space-y-2">
      {items.map((a) => {
        const done = a.status === 'completed' || a.status === 'no_show' || a.status === 'cancelled';
        const isNext = a.id === highlightNext;
        return (
          <li key={a.id}
            className={`flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border bg-white px-4 py-3 sm:px-5 ${
              isNext ? 'border-adey ring-2 ring-adey/60' : 'border-line'
            } ${done ? 'opacity-70' : ''}`}>
            <button type="button" onClick={() => open(a.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-5" title="Open details">
              <span className="w-16 shrink-0 sm:w-24">
                {showDate && <span className="block font-semibold text-roha-700">{dayName(clinicDateKey(a.starts_at))}</span>}
                <span className="block text-xl font-bold tabular-nums text-roha-900 sm:text-2xl">{formatClinicTime(a.starts_at)}</span>
                <span className="block text-sm text-ink-soft tabular-nums">until {formatClinicTime(a.ends_at)}</span>
                <span className="block text-sm font-medium text-roha-500" title="Ethiopian local time">{ethiopianTime(a.starts_at)}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`text-lg font-semibold text-ink ${a.status === 'cancelled' ? 'line-through' : ''}`}>{a.patient.full_name}</span>
                  {isNext && <span className="rounded bg-adey px-2 text-sm font-bold text-roha-900">Next</span>}
                </span>
                <span className="block text-ink-soft">
                  {lk?.service(a.service_id)?.name} · {lk?.dentist(a.dentist_id)?.full_name}
                  {!auth.scope && <> · {lk?.location(a.location_id)?.city}</>}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusBadge status={a.status} />
                  <span className="text-sm text-ink-soft">{SOURCE_LABEL[a.source]}{showRequested ? ` · asked ${fmtRelative(a.created_at)}` : ''}</span>
                  {a.patient_notes && (
                    <span className="inline-flex items-center gap-1 text-sm text-ink-soft" title={a.patient_notes}>
                      <Icon name="message" className="size-4" /> has a note
                    </span>
                  )}
                </span>
              </span>
            </button>
            <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {!done && <CallButton e164={a.patient.phone} small />}
              {a.status === 'pending' && new Date(a.starts_at).getTime() > now - 3600_000 && (
                <button type="button" className="btn-primary min-h-9 px-4 text-sm" disabled={confirm.isPending} onClick={() => confirm.mutate(a.id)}>
                  <Icon name="check" className="size-4" /> Confirm
                </button>
              )}
              <button type="button" className={btn.small} onClick={() => open(a.id)}>Details ›</button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
