import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, clinicDateKey, clinicIso, ethiopianTimeOfDay, formatClinicDate, formatClinicTime, formatEthiopianDate } from '@shared/time.ts';
import { supabase } from '../supabase';
import { useAuth } from '../auth';
import { errorMessage, useLookups } from '../data';
import { APPOINTMENT_SELECT, WEEKDAYS, type Appointment, type Dentist, type TimeOff, type WorkingHours } from '../types';
import { Card, Choice, Empty, ErrorBox, Field, Loading, PageHeader, StatusBadge, Tip, Toggle, btn, fmtDateTime, inputCls, inputInline, useConfirm, useOpenAppointment, useToast } from '../ui';
import { ScopeSelect, useWriteLocation } from './common';
import { dayName } from './Appointments';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hm = (t: string) => t.slice(0, 5);

export default function SchedulePage() {
  const locationId = useWriteLocation();
  const { data: lk } = useLookups();
  if (!locationId || !lk) return <Loading />;
  return (
    <>
      <PageHeader title="Working hours & days off" subtitle={`${lk.location(locationId)?.city} clinic`} actions={<ScopeSelect allowAll={false} />} />
      <div className="mb-6">
        <Tip>
          <p><b>Working hours</b> are the normal week of each dentist — set them once. Patients can only book online inside these hours.</p>
          <p><b>Days off</b> are exceptions: holidays, the clinic being closed, or a dentist on leave.</p>
        </Tip>
      </div>
      <div className="space-y-6">
        <HoursSection locationId={locationId} />
        <DaysOffSection locationId={locationId} />
      </div>
    </>
  );
}

// ---- weekly hours: simple editor -----------------------------------------------------------

type Week = { days: number[]; start: string; end: string; satEnd: string | null };
type HourRow = { weekday: number; start: string; end: string };

const PRESETS: { label: string; week: Week }[] = [
  { label: 'Mon–Sat, Saturday half day', week: { days: [1, 2, 3, 4, 5, 6], start: '08:30', end: '17:30', satEnd: '12:30' } },
  { label: 'Mon–Sat, full days', week: { days: [1, 2, 3, 4, 5, 6], start: '08:30', end: '17:30', satEnd: null } },
  { label: 'Monday to Friday', week: { days: [1, 2, 3, 4, 5], start: '08:30', end: '17:30', satEnd: null } },
];

/** "Mon–Fri 08:30–17:30 · Sat 08:30–12:30" */
export function describeWeek(rows: { weekday: number; start_time: string; end_time: string }[]): string {
  if (!rows.length) return 'No working hours yet';
  const groups = new Map<string, number[]>();
  for (const wd of WEEK_ORDER) {
    for (const r of rows.filter((x) => x.weekday === wd)) {
      const k = `${hm(r.start_time)}–${hm(r.end_time)}`;
      groups.set(k, [...(groups.get(k) ?? []), wd]);
    }
  }
  const dayRanges = (days: number[]) => {
    const idx = days.map((d) => WEEK_ORDER.indexOf(d)).sort((a, b) => a - b);
    const out: string[] = [];
    for (let i = 0; i < idx.length; i++) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
      const a = SHORT[WEEK_ORDER[idx[i]]], b = SHORT[WEEK_ORDER[idx[j]]];
      out.push(j - i >= 2 ? `${a}–${b}` : j > i ? `${a}, ${b}` : a);
      i = j;
    }
    return out.join(', ');
  };
  return [...groups.entries()].map(([time, days]) => `${dayRanges(days)} ${time}`).join(' · ');
}

function weekFromRows(rows: WorkingHours[]): { week: Week; split: boolean } {
  if (!rows.length) return { week: PRESETS[0].week, split: false };
  const days = [...new Set(rows.map((r) => r.weekday))];
  const split = days.some((d) => rows.filter((r) => r.weekday === d).length > 1);
  const count = new Map<string, number>();
  for (const r of rows.filter((r) => r.weekday !== 6)) {
    const k = `${hm(r.start_time)}|${hm(r.end_time)}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const main = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? `${hm(rows[0].start_time)}|${hm(rows[0].end_time)}`;
  const [start, end] = main.split('|');
  const sat = rows.find((r) => r.weekday === 6);
  return { week: { days, start, end, satEnd: sat && hm(sat.end_time) !== end ? hm(sat.end_time) : null }, split };
}

function rowsFromWeek(w: Week): HourRow[] {
  return WEEK_ORDER.filter((d) => w.days.includes(d)).map((d) => ({
    weekday: d, start: w.start, end: d === 6 && w.satEnd ? w.satEnd : w.end,
  }));
}

function HoursEditor({ initial, warnSplit, busy, saveLabel, onSave, onCancel }: {
  initial: Week; warnSplit?: boolean; busy: boolean; saveLabel: string; onSave: (rows: HourRow[]) => void; onCancel: () => void;
}) {
  const [w, setW] = useState<Week>(initial);
  const toggleDay = (d: number) => setW({ ...w, days: w.days.includes(d) ? w.days.filter((x) => x !== d) : [...w.days, d] });
  const problem = !w.days.length ? 'Choose at least one working day.'
    : w.end <= w.start ? 'The end time must be after the start time.'
      : w.satEnd !== null && w.days.includes(6) && w.satEnd <= w.start ? 'Saturday must end after the start time.' : null;

  return (
    <div className="space-y-5 rounded-xl border-2 border-roha-200 bg-white p-5">
      <div>
        <p className="mb-2 font-semibold">Quick choice</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => <button key={p.label} type="button" className={btn.small} onClick={() => setW(p.week)}>{p.label}</button>)}
        </div>
      </div>

      <div>
        <p className="mb-2 font-semibold">Working days</p>
        <div className="flex flex-wrap gap-2">
          {WEEK_ORDER.map((d) => {
            const on = w.days.includes(d);
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => toggleDay(d)}
                className={`min-h-11 min-w-16 rounded-lg border-2 px-3 font-semibold ${on ? 'border-roha-700 bg-roha-700 text-white' : 'border-line bg-white text-ink-soft hover:border-roha-300'}`}>
                {SHORT[d]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Field label="From" hint={ethiopianTimeOfDay(w.start)}>
          <input type="time" step={300} className={`${inputInline} w-36`} value={w.start} onChange={(e) => setW({ ...w, start: e.target.value })} />
        </Field>
        <Field label="Until" hint={ethiopianTimeOfDay(w.end)}>
          <input type="time" step={300} className={`${inputInline} w-36`} value={w.end} onChange={(e) => setW({ ...w, end: e.target.value })} />
        </Field>
      </div>

      {w.days.includes(6) && (
        <div className="flex flex-wrap items-center gap-4">
          <Toggle checked={w.satEnd !== null} onChange={(v) => setW({ ...w, satEnd: v ? '12:30' : null })} label="Shorter hours on Saturday" />
          {w.satEnd !== null && (
            <label className="flex items-center gap-2">
              <span>Saturday until</span>
              <input type="time" step={300} className={`${inputInline} w-36`} value={w.satEnd} onChange={(e) => setW({ ...w, satEnd: e.target.value })} />
            </label>
          )}
        </div>
      )}

      <p className="rounded-lg bg-enamel px-3 py-2"><b>Result:</b> {describeWeek(rowsFromWeek(w).map((r) => ({ weekday: r.weekday, start_time: r.start, end_time: r.end })))}</p>
      {warnSplit && <Tip tone="warn"><p>This dentist has split shifts on some days. Saving here replaces them with one block per day.</p></Tip>}
      {problem && <ErrorBox error={problem} />}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.primary} disabled={busy || !!problem} onClick={() => onSave(rowsFromWeek(w))}>{saveLabel}</button>
        <button type="button" className={btn.ghost} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function useSaveHours() {
  const toast = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobs: { dentistId: string; locationId: string; rows: HourRow[] }[]) => {
      for (const j of jobs) {
        const { error } = await supabase.rpc('set_working_hours', { p_dentist_id: j.dentistId, p_location_id: j.locationId, p_hours: j.rows });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast('Working hours saved');
      qc.invalidateQueries({ queryKey: ['lookups'] });
      qc.invalidateQueries({ queryKey: ['admin-slots'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
}

function HoursSection({ locationId }: { locationId: string }) {
  const { data: lk } = useLookups();
  const save = useSaveHours();
  const [adding, setAdding] = useState('');
  const [allOpen, setAllOpen] = useState(false);
  if (!lk) return null;
  const here = lk.dentists.filter((d) => lk.workingHours.some((w) => w.dentist_id === d.id && w.location_id === locationId));
  const others = lk.dentists.filter((d) => d.is_active && !here.includes(d));
  const addingDentist = lk.dentist(adding);

  return (
    <Card title="Weekly working hours"
      actions={here.length > 1 && !allOpen && <button type="button" className={btn.small} onClick={() => setAllOpen(true)}>Same hours for everyone</button>}>
      <div className="space-y-4">
        {allOpen && (
          <div>
            <p className="mb-2 font-semibold">Set the same hours for all {here.length} dentists at this clinic</p>
            <HoursEditor initial={PRESETS[0].week} busy={save.isPending} saveLabel={`Save for all ${here.length} dentists`}
              onCancel={() => setAllOpen(false)}
              onSave={(rows) => save.mutate(here.map((d) => ({ dentistId: d.id, locationId, rows })), { onSuccess: () => setAllOpen(false) })} />
          </div>
        )}

        {here.length === 0 && !addingDentist && <Empty icon="clock">No dentist has working hours at this clinic yet. Add one below.</Empty>}
        {here.map((d) => <DentistHours key={d.id} dentist={d} locationId={locationId} />)}

        {addingDentist ? (
          <div>
            <p className="mb-2 font-semibold">Working hours for {addingDentist.full_name} at this clinic</p>
            <HoursEditor initial={PRESETS[0].week} busy={save.isPending} saveLabel="Save hours" onCancel={() => setAdding('')}
              onSave={(rows) => save.mutate([{ dentistId: addingDentist.id, locationId, rows }], { onSuccess: () => setAdding('') })} />
          </div>
        ) : others.length > 0 && (
          <label className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Add a dentist to this clinic:</span>
            <select className={`${inputInline} w-auto`} value="" onChange={(e) => setAdding(e.target.value)}>
              <option value="">Choose…</option>
              {others.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </label>
        )}
      </div>
    </Card>
  );
}

function DentistHours({ dentist, locationId }: { dentist: Dentist; locationId: string }) {
  const { data: lk } = useLookups();
  const save = useSaveHours();
  const ask = useConfirm();
  const [mode, setMode] = useState<'view' | 'edit' | 'advanced'>('view');
  const rows = (lk?.workingHours ?? []).filter((w) => w.dentist_id === dentist.id && w.location_id === locationId);
  const elsewhere = (lk?.workingHours ?? []).filter((w) => w.dentist_id === dentist.id && w.location_id !== locationId);
  const { week, split } = weekFromRows(rows);

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">
            {dentist.full_name}
            {!dentist.is_active && <span className="ml-2 rounded bg-slate-100 px-1.5 text-sm text-slate-600">inactive</span>}
          </p>
          <p className="text-roha-800">{describeWeek(rows)}</p>
          {elsewhere.length > 0 && (
            <p className="text-sm text-ink-soft">Also at {lk?.location(elsewhere[0].location_id)?.city}: {describeWeek(elsewhere)}</p>
          )}
        </div>
        {mode === 'view' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn.ghost} onClick={() => setMode('edit')}>Edit hours</button>
            <button type="button" className={btn.small} onClick={() => setMode('advanced')}>Day by day</button>
            <button type="button" className={btn.small} disabled={save.isPending}
              onClick={async () => {
                if (await ask({ title: `Remove ${dentist.full_name} from this clinic?`, text: 'All their working hours here are deleted. Existing bookings stay.', yes: 'Remove hours', danger: true })) {
                  save.mutate([{ dentistId: dentist.id, locationId, rows: [] }]);
                }
              }}>Remove</button>
          </div>
        )}
      </div>
      {mode === 'edit' && (
        <div className="mt-4">
          <HoursEditor initial={week} warnSplit={split} busy={save.isPending} saveLabel="Save hours" onCancel={() => setMode('view')}
            onSave={(r) => save.mutate([{ dentistId: dentist.id, locationId, rows: r }], { onSuccess: () => setMode('view') })} />
        </div>
      )}
      {mode === 'advanced' && (
        <div className="mt-4">
          <DayByDay dentist={dentist} locationId={locationId} />
          <button type="button" className={`${btn.small} mt-3`} onClick={() => setMode('view')}>Done</button>
        </div>
      )}
    </div>
  );
}

/** Advanced: individual shifts per weekday (e.g. a lunch break or split shifts). */
function DayByDay({ dentist, locationId }: { dentist: Dentist; locationId: string }) {
  const { data: lk } = useLookups();
  const toast = useToast();
  const qc = useQueryClient();
  const [adding, setAdding] = useState<number | null>(null);
  const [start, setStart] = useState('08:30');
  const [end, setEnd] = useState('12:30');
  const rows = (lk?.workingHours ?? []).filter((w) => w.dentist_id === dentist.id && w.location_id === locationId);
  const done = (msg: string) => {
    toast(msg);
    qc.invalidateQueries({ queryKey: ['lookups'] });
    qc.invalidateQueries({ queryKey: ['admin-slots'] });
  };
  const add = useMutation({
    mutationFn: async (weekday: number) => {
      const { error } = await supabase.from('working_hours').insert({ dentist_id: dentist.id, location_id: locationId, weekday, start_time: start, end_time: end });
      if (error) throw error;
    },
    onSuccess: () => { setAdding(null); done('Shift added'); },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('working_hours').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => done('Shift removed'),
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (end <= start) return toast('End time must be after start time', 'error');
    add.mutate(adding!);
  }

  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {WEEK_ORDER.map((wd) => {
        const mine = rows.filter((r) => r.weekday === wd);
        return (
          <li key={wd} className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-2">
            <span className="w-28 font-semibold">{WEEKDAYS[wd]}</span>
            {mine.length === 0 && <span className="text-ink-soft">Day off</span>}
            {mine.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1 rounded-lg bg-roha-100 px-3 py-1 font-semibold tabular-nums text-roha-800">
                {hm(r.start_time)}–{hm(r.end_time)}
                <button type="button" className="ml-1 rounded px-1 text-lg leading-none text-roha-500 hover:bg-red-50 hover:text-red-700"
                  aria-label={`Remove ${WEEKDAYS[wd]} ${hm(r.start_time)}`} disabled={remove.isPending} onClick={() => remove.mutate(r.id)}>×</button>
              </span>
            ))}
            {adding === wd ? (
              <form className="flex flex-wrap items-center gap-2" onSubmit={submit}>
                <input type="time" step={300} className={`${inputInline} w-32`} value={start} onChange={(e) => setStart(e.target.value)} aria-label="From" />
                <span>–</span>
                <input type="time" step={300} className={`${inputInline} w-32`} value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Until" />
                <button type="submit" className={btn.small} disabled={add.isPending}>Add</button>
                <button type="button" className="text-sm text-ink-soft hover:text-ink" onClick={() => setAdding(null)}>Cancel</button>
              </form>
            ) : (
              <button type="button" className={`${btn.small} ml-auto`} onClick={() => setAdding(wd)}>+ Add shift</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---- days off ---------------------------------------------------------------------------

function DaysOffSection({ locationId }: { locationId: string }) {
  const auth = useAuth();
  const { data: lk } = useLookups();
  const toast = useToast();
  const ask = useConfirm();
  const qc = useQueryClient();
  const open = useOpenAppointment();
  const today = clinicDateKey();

  const list = useQuery({
    queryKey: ['time-off', locationId],
    queryFn: async () => {
      const { data, error } = await supabase.from('time_off').select('id, dentist_id, location_id, starts_at, ends_at, reason, created_at')
        .or(`location_id.eq.${locationId},location_id.is.null`)
        .gte('ends_at', new Date().toISOString()).order('starts_at');
      if (error) throw error;
      return data as TimeOff[];
    },
  });

  const [who, setWho] = useState<'clinic' | 'dentist'>('clinic');
  const [dentistId, setDentistId] = useState('');
  const [everywhere, setEverywhere] = useState(false);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [partDay, setPartDay] = useState(false);
  const [fromTime, setFromTime] = useState('12:30');
  const [toTime, setToTime] = useState('17:30');
  const [reason, setReason] = useState('');
  const [conflicts, setConflicts] = useState<Appointment[] | null>(null);
  const dentistsHere = useMemo(() => lk?.dentistsFor(locationId) ?? [], [lk, locationId]);

  const range = partDay
    ? { starts_at: clinicIso(from, fromTime), ends_at: clinicIso(from, toTime) }
    : { starts_at: clinicIso(from, '00:00'), ends_at: clinicIso(addDays(to, 1), '00:00') };
  const dentist = who === 'dentist' ? dentistId : '';

  const create = useMutation({
    mutationFn: async () => {
      const row = { dentist_id: dentist || null, location_id: dentist && everywhere ? null : locationId, reason: reason.trim() || null, ...range };
      const { error } = await supabase.from('time_off').insert(row);
      if (error) throw error;
      // Existing bookings are NOT cancelled automatically — list them so staff can call the patients.
      let q = supabase.from('appointments').select(APPOINTMENT_SELECT).in('status', ['pending', 'confirmed'])
        .lt('starts_at', range.ends_at).gt('ends_at', range.starts_at).order('starts_at');
      if (dentist) q = q.eq('dentist_id', dentist);
      if (!(dentist && everywhere)) q = q.eq('location_id', locationId);
      const { data } = await q;
      return (data ?? []) as unknown as Appointment[];
    },
    onSuccess: (found) => {
      setReason('');
      setConflicts(found);
      toast(found.length ? `Saved. ${found.length} booked patient(s) need a call — see the list.` : 'Saved', found.length ? 'info' : 'ok');
      qc.invalidateQueries({ queryKey: ['time-off'] });
      qc.invalidateQueries({ queryKey: ['admin-slots'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_off').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast('Removed');
      qc.invalidateQueries({ queryKey: ['time-off'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  const problem = who === 'dentist' && !dentistId ? 'Choose the dentist.'
    : partDay ? (toTime <= fromTime ? 'The end time must be after the start time.' : null)
      : to < from ? '“Until” must be on or after “From”.' : null;

  const describe = (t: TimeOff) => {
    const lastDay = clinicDateKey(new Date(new Date(t.ends_at).getTime() - 1));
    const fullDays = formatClinicTime(t.starts_at) === '00:00' && formatClinicTime(t.ends_at) === '00:00';
    const first = clinicDateKey(t.starts_at);
    if (fullDays) {
      return first === lastDay
        ? `${formatClinicDate(first, 'en-GB', false)} (${formatEthiopianDate(first, 'am', false)})`
        : `${formatClinicDate(first, 'en-GB', false)} – ${formatClinicDate(lastDay, 'en-GB', false)}`;
    }
    return first === lastDay
      ? `${formatClinicDate(first, 'en-GB', false)}, ${formatClinicTime(t.starts_at)}–${formatClinicTime(t.ends_at)}`
      : `${fmtDateTime(t.starts_at)} – ${fmtDateTime(t.ends_at)}`;
  };

  return (
    <Card title="Days off & closures">
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div>
          <p className="mb-2 font-semibold">Coming up</p>
          {list.isError ? (
            <ErrorBox error={errorMessage(list.error)} onRetry={() => list.refetch()} />
          ) : list.isPending ? (
            <Loading />
          ) : list.data.length === 0 ? (
            <Empty icon="calendar">Nothing planned. Add holidays, closures and leave with the form.</Empty>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {list.data.map((t) => {
                const canDelete = auth.isOwner || t.location_id === auth.profile?.location_id;
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {t.dentist_id ? `${lk?.dentist(t.dentist_id)?.full_name} is away` : 'Clinic closed'}
                        {t.dentist_id && !t.location_id && <span className="font-normal text-ink-soft"> (both clinics)</span>}
                      </span>
                      <span className="block">{describe(t)}{t.reason && <span className="text-ink-soft"> — {t.reason}</span>}</span>
                    </span>
                    {canDelete && (
                      <button type="button" className={btn.small} disabled={remove.isPending}
                        onClick={async () => { if (await ask({ title: 'Remove this day off?', text: 'Patients will be able to book these times online again.', yes: 'Yes, remove', danger: true })) remove.mutate(t.id); }}>
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {conflicts && conflicts.length > 0 && (
            <div className="mt-4 rounded-lg border-2 border-adey bg-adey-soft/50 p-4">
              <p className="font-semibold">Important: these patients are already booked in that time. Their bookings were NOT cancelled. Please call each one, then change the time or cancel:</p>
              <ul className="mt-2 space-y-1">
                {conflicts.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="link" onClick={() => open(a.id)}>
                      {fmtDateTime(a.starts_at)} · {a.patient.full_name} · {lk?.dentist(a.dentist_id)?.full_name}
                    </button>{' '}
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
              <button type="button" className="mt-2 text-sm text-ink-soft hover:text-ink" onClick={() => setConflicts(null)}>Dismiss</button>
            </div>
          )}
        </div>

        <form className="space-y-4 rounded-xl bg-enamel p-4" onSubmit={(e) => { e.preventDefault(); if (!problem) create.mutate(); }}>
          <p className="text-lg font-bold text-roha-900">Add a day off</p>
          <Choice label="What happens?" value={who} onChange={setWho} options={[
            { value: 'clinic', title: 'Clinic closed', text: 'Nobody can book.' },
            { value: 'dentist', title: 'A dentist is away', text: 'Only that dentist.' },
          ]} />
          {who === 'dentist' && (
            <>
              <Field label="Which dentist?">
                <select className={inputCls} value={dentistId} onChange={(e) => setDentistId(e.target.value)}>
                  <option value="">Choose…</option>
                  {dentistsHere.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
              </Field>
              {auth.isOwner && <Toggle checked={everywhere} onChange={setEverywhere} label="Away from both clinics" />}
            </>
          )}

          <div>
            <p className="mb-1.5 font-semibold">When?</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {[0, 1].map((n) => {
                const d = addDays(today, n);
                const on = from === d && to === d;
                return <button key={n} type="button" className={on ? btn.primary : btn.ghost} onClick={() => { setFrom(d); setTo(d); }}>{dayName(d)}</button>;
              })}
            </div>
            {partDay ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Day" className="col-span-2"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
                <Field label="From" hint={ethiopianTimeOfDay(fromTime)}><input type="time" step={300} className={inputCls} value={fromTime} onChange={(e) => setFromTime(e.target.value)} /></Field>
                <Field label="Until" hint={ethiopianTimeOfDay(toTime)}><input type="time" step={300} className={inputCls} value={toTime} onChange={(e) => setToTime(e.target.value)} /></Field>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Field label="From" hint={formatEthiopianDate(from, 'am', false)}>
                  <input type="date" className={inputCls} value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} />
                </Field>
                <Field label="Until (incl.)" hint={formatEthiopianDate(to, 'am', false)}>
                  <input type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
                </Field>
              </div>
            )}
            <button type="button" className="link mt-2 text-sm" onClick={() => setPartDay((v) => !v)}>
              {partDay ? 'Make it whole days instead' : 'Only part of a day?'}
            </button>
          </div>

          <Field label="Reason (optional)">
            <input className={inputCls} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Holiday, training" />
          </Field>
          {problem && <p className="text-sm text-red-700">{problem}</p>}
          <button type="submit" className={`${btn.primary} w-full`} disabled={!!problem || create.isPending}>Save day off</button>
        </form>
      </div>
    </Card>
  );
}
