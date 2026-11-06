import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, clinicDateKey, clinicIso, formatClinicDate, formatClinicTime } from '@shared/time.ts';
import { supabase } from '../supabase';
import { useAuth } from '../auth';
import { errorMessage, useLookups } from '../data';
import { APPOINTMENT_SELECT, WEEKDAYS, type Appointment, type Dentist, type TimeOff, type WorkingHours } from '../types';
import { Card, Empty, ErrorBox, Field, Loading, PageHeader, StatusBadge, Toggle, btn, fmtDateTime, inputCls, inputInline, useConfirm, useOpenAppointment, useToast } from '../ui';
import { ScopeSelect, useWriteLocation } from './common';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const hm = (t: string) => t.slice(0, 5);

export default function SchedulePage() {
  const locationId = useWriteLocation();
  const { data: lk } = useLookups();
  if (!locationId || !lk) return <Loading />;
  return (
    <>
      <PageHeader title="Working hours & days off" subtitle={`${lk.location(locationId)?.city} clinic. Patients can only book online inside these hours.`}
        actions={<ScopeSelect allowAll={false} />} />
      <div className="space-y-6">
        <TimeOffSection locationId={locationId} />
        <WorkingHoursSection locationId={locationId} />
      </div>
    </>
  );
}

// ---- working hours ----------------------------------------------------------------------

function WorkingHoursSection({ locationId }: { locationId: string }) {
  const { data: lk } = useLookups();
  const [extra, setExtra] = useState<string[]>([]);
  if (!lk) return null;
  const here = lk.dentists.filter((d) => lk.workingHours.some((w) => w.dentist_id === d.id && w.location_id === locationId) || extra.includes(d.id));
  const others = lk.dentists.filter((d) => d.is_active && !here.includes(d));

  return (
    <Card title="Weekly working hours (every week)"
      actions={others.length > 0 && (
        <select className={`${inputInline} w-auto`} value="" aria-label="Add a dentist to this clinic"
          onChange={(e) => e.target.value && setExtra((x) => [...x, e.target.value])}>
          <option value="">+ Add a dentist to this clinic…</option>
          {others.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
        </select>
      )}>
      {here.length === 0 ? (
        <Empty>No dentist has hours at this clinic yet.</Empty>
      ) : (
        <div className="space-y-6">
          {here.map((d) => <DentistWeek key={d.id} dentist={d} locationId={locationId} />)}
        </div>
      )}
    </Card>
  );
}

function DentistWeek({ dentist, locationId }: { dentist: Dentist; locationId: string }) {
  const { data: lk } = useLookups();
  const toast = useToast();
  const qc = useQueryClient();
  const [adding, setAdding] = useState<number | null>(null);
  const [start, setStart] = useState('08:30');
  const [end, setEnd] = useState('17:30');

  const rows = (lk?.workingHours ?? []).filter((w) => w.dentist_id === dentist.id);
  const done = (msg: string) => {
    toast(msg);
    qc.invalidateQueries({ queryKey: ['lookups'] });
    qc.invalidateQueries({ queryKey: ['admin-slots'] });
  };
  const add = useMutation({
    mutationFn: async (weekdays: number[]) => {
      const { error } = await supabase.from('working_hours').insert(
        weekdays.map((weekday) => ({ dentist_id: dentist.id, location_id: locationId, weekday, start_time: start, end_time: end })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setAdding(null);
      done('Hours added');
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('working_hours').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => done('Hours removed'),
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  function submit(e: FormEvent, all: boolean) {
    e.preventDefault();
    if (end <= start) return toast('End time must be after start time', 'error');
    const emptyWeekdays = WEEK_ORDER.filter((wd) => wd !== 0 && !rows.some((r) => r.weekday === wd && r.location_id === locationId));
    add.mutate(all ? emptyWeekdays : [adding!]);
  }

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-base">
        {dentist.full_name}
        {!dentist.is_active && <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">inactive</span>}
        {!dentist.accepts_online_booking && <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">no online booking</span>}
      </h3>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {WEEK_ORDER.map((wd) => {
          const mine = rows.filter((r) => r.weekday === wd && r.location_id === locationId);
          const elsewhere = rows.filter((r) => r.weekday === wd && r.location_id !== locationId);
          return (
            <li key={wd} className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-2">
              <span className="w-28 font-semibold">{WEEKDAYS[wd]}</span>
              {mine.length === 0 && <span className="text-ink-soft">Day off</span>}
              {mine.map((r: WorkingHours) => (
                <span key={r.id} className="inline-flex items-center gap-1 rounded-lg bg-roha-100 px-3 py-1 font-semibold tabular-nums text-roha-800">
                  {hm(r.start_time)}–{hm(r.end_time)}
                  <button type="button" className="ml-1 rounded px-1 text-lg leading-none text-roha-500 hover:bg-red-50 hover:text-red-700" aria-label={`Remove ${WEEKDAYS[wd]} ${hm(r.start_time)}`}
                    disabled={remove.isPending} onClick={() => remove.mutate(r.id)}>×</button>
                </span>
              ))}
              {elsewhere.map((r) => (
                <span key={r.id} className="rounded-lg bg-slate-100 px-2 py-1 text-sm tabular-nums text-slate-600">
                  {lk?.location(r.location_id)?.city} {hm(r.start_time)}–{hm(r.end_time)}
                </span>
              ))}
              {adding === wd ? (
                <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => submit(e, false)}>
                  <input type="time" step={300} className={`${inputInline} w-28`} value={start} onChange={(e) => setStart(e.target.value)} aria-label="From" />
                  <span>–</span>
                  <input type="time" step={300} className={`${inputInline} w-28`} value={end} onChange={(e) => setEnd(e.target.value)} aria-label="To" />
                  <button type="submit" className={btn.small} disabled={add.isPending}>Add</button>
                  {wd !== 0 && (
                    <button type="button" className={btn.small} disabled={add.isPending} onClick={(e) => submit(e, true)}
                      title="Add these hours to every Monday–Saturday that has none yet">Same hours Monday–Saturday</button>
                  )}
                  <button type="button" className="text-sm text-ink-soft hover:text-ink" onClick={() => setAdding(null)}>Cancel</button>
                </form>
              ) : (
                <button type="button" className={`${btn.small} ml-auto`} onClick={() => setAdding(wd)}>+ Add hours</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---- time off ---------------------------------------------------------------------------

function TimeOffSection({ locationId }: { locationId: string }) {
  const auth = useAuth();
  const { data: lk } = useLookups();
  const toast = useToast();
  const qc = useQueryClient();
  const open = useOpenAppointment();
  const ask = useConfirm();
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

  const [who, setWho] = useState(''); // '' = whole clinic
  const [everywhere, setEverywhere] = useState(false);
  const [allDay, setAllDay] = useState(true);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [fromTime, setFromTime] = useState('12:00');
  const [toTime, setToTime] = useState('17:30');
  const [reason, setReason] = useState('');
  const [conflicts, setConflicts] = useState<Appointment[] | null>(null);
  const dentistsHere = useMemo(() => lk?.dentistsFor(locationId) ?? [], [lk, locationId]);

  const range = allDay
    ? { starts_at: clinicIso(from, '00:00'), ends_at: clinicIso(addDays(to, 1), '00:00') }
    : { starts_at: clinicIso(from, fromTime), ends_at: clinicIso(from, toTime) };

  const create = useMutation({
    mutationFn: async () => {
      const row = { dentist_id: who || null, location_id: who && everywhere ? null : locationId, reason: reason.trim() || null, ...range };
      const { error } = await supabase.from('time_off').insert(row);
      if (error) throw error;
      // Existing bookings are NOT cancelled automatically — find them so staff can call patients.
      let q = supabase.from('appointments').select(APPOINTMENT_SELECT).in('status', ['pending', 'confirmed'])
        .lt('starts_at', range.ends_at).gt('ends_at', range.starts_at).order('starts_at');
      if (who) q = q.eq('dentist_id', who);
      if (!(who && everywhere)) q = q.eq('location_id', locationId);
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

  const valid = allDay ? to >= from : toTime > fromTime;
  const describe = (t: TimeOff) => {
    const sameDay = clinicDateKey(t.starts_at) === clinicDateKey(new Date(new Date(t.ends_at).getTime() - 1));
    const fullDays = formatClinicTime(t.starts_at) === '00:00' && formatClinicTime(t.ends_at) === '00:00';
    if (fullDays) {
      const last = clinicDateKey(new Date(new Date(t.ends_at).getTime() - 1));
      return sameDay ? formatClinicDate(t.starts_at, 'en-GB', false) : `${formatClinicDate(t.starts_at, 'en-GB', false)} – ${formatClinicDate(last, 'en-GB', false)}`;
    }
    return sameDay
      ? `${formatClinicDate(t.starts_at, 'en-GB', false)}, ${formatClinicTime(t.starts_at)}–${formatClinicTime(t.ends_at)}`
      : `${fmtDateTime(t.starts_at)} – ${fmtDateTime(t.ends_at)}`;
  };

  return (
    <Card title="Days off & closures">
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {list.isError ? (
            <ErrorBox error={errorMessage(list.error)} onRetry={() => list.refetch()} />
          ) : list.isPending ? (
            <Loading />
          ) : list.data.length === 0 ? (
            <Empty icon="calendar">No days off planned. Add holidays, closures and dentists’ leave on the right.</Empty>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {list.data.map((t) => {
                const canDelete = auth.isOwner || t.location_id === auth.profile?.location_id;
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <span className="font-semibold">{t.dentist_id ? `${lk?.dentist(t.dentist_id)?.full_name} is away` : 'Clinic closed'}</span>
                    {t.dentist_id && !t.location_id && <span className="text-xs text-ink-soft">(all clinics)</span>}
                    <span className="tabular-nums">{describe(t)}</span>
                    {t.reason && <span className="text-ink-soft">— {t.reason}</span>}
                    {canDelete && (
                      <button type="button" className={`${btn.small} ml-auto`} disabled={remove.isPending}
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
            <div className="mt-4 rounded-lg border border-adey bg-adey-soft/50 p-3 text-sm">
              <p className="font-semibold">Important: these patients are already booked in that time. Their bookings were NOT cancelled. Please call each one, then change the time or cancel:</p>
              <ul className="mt-2 space-y-1">
                {conflicts.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="link text-sm" onClick={() => open(a.id)}>
                      {fmtDateTime(a.starts_at)} · {a.patient.full_name} · {lk?.dentist(a.dentist_id)?.full_name}
                    </button>{' '}
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
              <button type="button" className="mt-2 text-xs text-ink-soft hover:text-ink" onClick={() => setConflicts(null)}>Dismiss</button>
            </div>
          )}
        </div>

        <form className="space-y-3 rounded-lg bg-enamel p-4" onSubmit={(e) => { e.preventDefault(); if (valid) create.mutate(); }}>
          <p className="text-lg font-bold text-roha-900">Add a day off or closure</p>
          <Field label="Who is away?">
            <select className={inputCls} value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">The whole clinic is closed</option>
              {dentistsHere.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </Field>
          {who && auth.isOwner && <Toggle checked={everywhere} onChange={setEverywhere} label="Away from both clinics" />}
          <Toggle checked={allDay} onChange={setAllDay} label="Full days (untick for a few hours)" />
          {allDay ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="From"><input type="date" className={inputCls} value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} /></Field>
              <Field label="Until (incl.)"><input type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Field label="Day" className="col-span-3"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="From"><input type="time" step={300} className={inputCls} value={fromTime} onChange={(e) => setFromTime(e.target.value)} /></Field>
              <Field label="To"><input type="time" step={300} className={inputCls} value={toTime} onChange={(e) => setToTime(e.target.value)} /></Field>
            </div>
          )}
          <Field label="Reason (optional)">
            <input className={inputCls} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Holiday, training" />
          </Field>
          <button type="submit" className={`${btn.primary} w-full`} disabled={!valid || create.isPending}>Save</button>
        </form>
      </div>
    </Card>
  );
}
