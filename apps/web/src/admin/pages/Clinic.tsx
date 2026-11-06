// Owner: clinics, services, dentists (+ which services each dentist offers).
// Note: the public marketing pages (src/content/*) are static; these records drive booking & SMS.
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { normalizeEthiopianPhone } from '@shared/phone.ts';
import { supabase } from '../supabase';
import { errorMessage, useLookups } from '../data';
import type { Dentist, Location, Service } from '../types';
import { Card, Field, PageHeader, Toggle, btn, inputCls, inputInline, useToast } from '../ui';

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/^dr\.?\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function useSave(table: 'locations' | 'services' | 'dentists') {
  const toast = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id?: string; patch: Record<string, unknown> }) => {
      const { error } = id ? await supabase.from(table).update(patch).eq('id', id) : await supabase.from(table).insert(patch);
      if (error) throw error;
    },
    onSuccess: () => {
      toast('Saved');
      qc.invalidateQueries({ queryKey: ['lookups'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
}

export default function ClinicPage() {
  const { data: lk } = useLookups();
  if (!lk) return null;
  return (
    <>
      <PageHeader title="Clinic setup" subtitle="What patients can book online, and where the new-booking SMS alerts go." />
      <div className="space-y-6">
        <Card title="Clinics">
          <div className="grid gap-5 xl:grid-cols-2">{lk.locations.map((l) => <LocationForm key={l.id} l={l} />)}</div>
        </Card>
        <Card title="Dentists" actions={<NewDentist />}>
          <div className="space-y-4">{lk.dentists.map((d) => <DentistForm key={d.id} d={d} />)}</div>
        </Card>
        <Card title="Services" actions={<NewService />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-xs text-ink-soft">
                <tr><th className="py-2 pr-2">Name</th><th className="px-2">Minutes</th><th className="px-2">From (ETB)</th><th className="px-2">Online</th><th className="px-2">Active</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-line">{lk.services.map((s) => <ServiceRow key={s.id} s={s} />)}</tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

function LocationForm({ l }: { l: Location }) {
  const save = useSave('locations');
  const [v, setV] = useState(l);
  useEffect(() => setV(l), [l]);
  const alert = v.alert_phone?.trim() ? normalizeEthiopianPhone(v.alert_phone) : null;
  const badAlert = alert !== null && !alert.ok;
  const dirty = JSON.stringify(v) !== JSON.stringify(l);
  const set = <K extends keyof Location>(k: K, x: Location[K]) => setV({ ...v, [k]: x });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (badAlert) return;
    save.mutate({
      id: l.id,
      patch: {
        name: v.name.trim(), city: v.city.trim(), phone: v.phone.trim(), address: v.address?.trim() || null,
        alert_phone: alert && alert.ok ? alert.e164 : null, opening_hours_note: v.opening_hours_note?.trim() || null, is_active: v.is_active,
      },
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-line p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base">{l.city}</h3>
        <Toggle checked={v.is_active} onChange={(x) => set('is_active', x)} label="Active" />
      </div>
      <Field label="Name"><input className={inputCls} value={v.name} onChange={(e) => set('name', e.target.value)} required /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="City"><input className={inputCls} value={v.city} onChange={(e) => set('city', e.target.value)} required /></Field>
        <Field label="Public phone" hint="Shown in SMS as {location_phone}."><input className={inputCls} value={v.phone} onChange={(e) => set('phone', e.target.value)} required /></Field>
      </div>
      <Field label="Address"><input className={inputCls} value={v.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="New-booking alert phone" hint="Receives an SMS for each online booking here." error={badAlert ? 'Must be an Ethio Telecom 09… mobile.' : null}>
          <input className={inputCls} inputMode="tel" value={v.alert_phone ?? ''} onChange={(e) => set('alert_phone', e.target.value)} />
        </Field>
        <Field label="Opening hours note"><input className={inputCls} value={v.opening_hours_note ?? ''} onChange={(e) => set('opening_hours_note', e.target.value)} /></Field>
      </div>
      {dirty && <button type="submit" className={btn.primary} disabled={save.isPending || badAlert}>Save {l.city}</button>}
    </form>
  );
}

function DentistForm({ d }: { d: Dentist }) {
  const { data: lk } = useLookups();
  const save = useSave('dentists');
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState(d);
  useEffect(() => setV(d), [d]);
  const dirty = JSON.stringify(v) !== JSON.stringify(d);
  const offered = new Set((lk?.dentistServices ?? []).filter((x) => x.dentist_id === d.id).map((x) => x.service_id));

  const toggleService = useMutation({
    mutationFn: async ({ serviceId, on }: { serviceId: string; on: boolean }) => {
      const { error } = on
        ? await supabase.from('dentist_services').insert({ dentist_id: d.id, service_id: serviceId })
        : await supabase.from('dentist_services').delete().eq('dentist_id', d.id).eq('service_id', serviceId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lookups'] }),
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  return (
    <div className="rounded-lg border border-line p-4">
      <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ id: d.id, patch: { full_name: v.full_name.trim(), title: v.title?.trim() || null, is_active: v.is_active, accepts_online_booking: v.accepts_online_booking } });
      }}>
        <Field label="Name"><input className={inputCls} value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} required minLength={2} /></Field>
        <Field label="Title"><input className={inputCls} value={v.title ?? ''} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Orthodontist" /></Field>
        <div className="flex flex-col justify-end gap-1 pb-1">
          <Toggle checked={v.is_active} onChange={(x) => setV({ ...v, is_active: x })} label="Active" />
          <Toggle checked={v.accepts_online_booking} onChange={(x) => setV({ ...v, accepts_online_booking: x })} label="Online booking" />
        </div>
        {dirty && <button type="submit" className={`${btn.primary} sm:col-span-3 sm:justify-self-start`} disabled={save.isPending}>Save {d.full_name}</button>}
      </form>
      <p className="mt-3 mb-1 text-xs font-semibold text-ink-soft">Services offered</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {lk?.services.map((s) => (
          <Toggle key={s.id} checked={offered.has(s.id)} disabled={toggleService.isPending}
            onChange={(on) => toggleService.mutate({ serviceId: s.id, on })} label={s.name} />
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-soft">Working hours are set on the Schedule page.</p>
    </div>
  );
}

function ServiceRow({ s }: { s: Service }) {
  const save = useSave('services');
  const [v, setV] = useState(s);
  useEffect(() => setV(s), [s]);
  const dirty = JSON.stringify(v) !== JSON.stringify(s);
  return (
    <tr>
      <td className="py-2 pr-2"><input className={inputCls} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label="Service name" /></td>
      <td className="px-2"><input type="number" step={5} min={5} max={480} className={`${inputInline} w-20`} value={v.duration_minutes} onChange={(e) => setV({ ...v, duration_minutes: Number(e.target.value) })} aria-label="Duration" /></td>
      <td className="px-2"><input type="number" min={0} className={`${inputInline} w-28`} value={v.price_from_etb ?? ''} onChange={(e) => setV({ ...v, price_from_etb: e.target.value === '' ? null : Number(e.target.value) })} aria-label="Price from" /></td>
      <td className="px-2"><input type="checkbox" className="size-4 accent-roha-700" checked={v.is_bookable} onChange={(e) => setV({ ...v, is_bookable: e.target.checked })} aria-label="Bookable online" /></td>
      <td className="px-2"><input type="checkbox" className="size-4 accent-roha-700" checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} aria-label="Active" /></td>
      <td className="pl-2 text-right">
        {dirty && (
          <button type="button" className={btn.small} disabled={save.isPending}
            onClick={() => save.mutate({ id: s.id, patch: { name: v.name.trim(), duration_minutes: v.duration_minutes, price_from_etb: v.price_from_etb, is_bookable: v.is_bookable, is_active: v.is_active } })}>
            Save
          </button>
        )}
      </td>
    </tr>
  );
}

function NewDentist() {
  const save = useSave('dentists');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  if (!open) return <button type="button" className={btn.small} onClick={() => setOpen(true)}>+ Add dentist</button>;
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
      e.preventDefault();
      save.mutate({ patch: { full_name: name.trim(), title: title.trim() || null, slug: slugify(name) || `dentist-${Date.now()}` } }, {
        onSuccess: () => { setOpen(false); setName(''); setTitle(''); },
      });
    }}>
      <input className={`${inputInline} w-48`} placeholder="Dr. Full Name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
      <input className={`${inputInline} w-40`} placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button type="submit" className={btn.small} disabled={save.isPending}>Add</button>
      <button type="button" className="text-xs text-ink-soft" onClick={() => setOpen(false)}>cancel</button>
    </form>
  );
}

function NewService() {
  const save = useSave('services');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(30);
  if (!open) return <button type="button" className={btn.small} onClick={() => setOpen(true)}>+ Add service</button>;
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
      e.preventDefault();
      save.mutate({ patch: { name: name.trim(), duration_minutes: minutes, slug: slugify(name) || `service-${Date.now()}`, sort_order: 100 } }, {
        onSuccess: () => { setOpen(false); setName(''); },
      });
    }}>
      <input className={`${inputInline} w-48`} placeholder="Service name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
      <input type="number" step={5} min={5} max={480} className={`${inputInline} w-20`} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Minutes" />
      <button type="submit" className={btn.small} disabled={save.isPending}>Add</button>
      <button type="button" className="text-xs text-ink-soft" onClick={() => setOpen(false)}>cancel</button>
    </form>
  );
}
