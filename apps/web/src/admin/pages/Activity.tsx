import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { errorMessage, useLookups } from '../data';
import type { AuditRow } from '../types';
import { Empty, ErrorBox, Loading, PageHeader, btn, fmtDateTime, inputInline, useOpenAppointment } from '../ui';
import { CLEARED_LABEL, ClearHistoryButton, RowCheck, SelectionBar, useSelection } from './ClearHistory';

const ENTITIES = ['appointments', 'profiles', 'settings', 'sms_templates'];
const HIDE = new Set(['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'patient_id', 'location_id']);

export default function ActivityPage() {
  const { data: lk } = useLookups();
  const open = useOpenAppointment();
  const [entity, setEntity] = useState('');
  const [limit, setLimit] = useState(100);
  const sel = useSelection();

  const people = useQuery({
    queryKey: ['profile-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name');
      if (error) throw error;
      return new Map((data as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
    },
  });
  const q = useQuery({
    queryKey: ['audit', entity, limit],
    queryFn: async () => {
      let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
      if (entity) query = query.eq('entity', entity);
      const { data, error } = await query;
      if (error) throw error;
      return data as AuditRow[];
    },
  });

  const value = (k: string, v: unknown): string => {
    if (v === null || v === undefined) return '—';
    if (k === 'dentist_id') return lk?.dentist(String(v))?.full_name ?? String(v);
    if (k === 'service_id') return lk?.service(String(v))?.name ?? String(v);
    if (k.endsWith('_at') && typeof v === 'string') return fmtDateTime(v);
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };
  const summary = (r: AuditRow) => {
    const c = r.changes ?? {};
    if (r.action === 'insert' || r.action === 'delete') return '';
    return Object.entries(c)
      .filter(([k]) => !HIDE.has(k))
      .map(([k, d]) => {
        const diff = d as { from?: unknown; to?: unknown };
        return `${k.replace(/_/g, ' ')}: ${value(k, diff.from)} → ${value(k, diff.to)}`;
      })
      .join(' · ');
  };

  return (
    <>
      <PageHeader title="Activity" subtitle="Who changed what — bookings, staff accounts, settings and SMS templates."
        actions={
          <>
            <select className={`${inputInline} w-auto`} value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Filter">
              <option value="">Everything</option>
              {ENTITIES.map((e) => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
            </select>
            <ClearHistoryButton kind="activity" />
          </>
        } />
      {q.isError ? (
        <ErrorBox error={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <Loading />
      ) : q.data.length === 0 ? (
        <Empty>No activity yet.</Empty>
      ) : (
        <>
        <SelectionBar kind="activity" sel={sel} shownIds={q.data.map((r) => String(r.id))} />
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white text-sm">
          {q.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5">
              <RowCheck sel={sel} id={String(r.id)} label={`entry from ${fmtDateTime(r.created_at)}`} />
              <span className="w-28 shrink-0 tabular-nums text-ink-soft">{fmtDateTime(r.created_at)}</span>
              <span className="w-36 shrink-0 font-semibold">
                {r.actor_id ? people.data?.get(r.actor_id) ?? 'Staff' : r.actor_type === 'patient' ? 'Patient (link)' : 'System / online'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">
                  {r.action === 'clear_history' || r.action === 'delete_selected'
                    ? `${r.action === 'clear_history' ? 'Cleared all' : 'Deleted selected'} ${CLEARED_LABEL[r.entity] ?? r.entity}`
                    : `${r.entity.replace('_', ' ')} · ${r.action.replace('status:', 'status → ')}`}
                </span>
                {r.entity === 'appointments' && r.entity_id && (
                  <button type="button" className="link ml-2 text-xs" onClick={() => open(r.entity_id!)}>open</button>
                )}
                {summary(r) && <span className="block text-xs text-ink-soft">{summary(r)}</span>}
              </span>
            </li>
          ))}
        </ul>
        </>
      )}
      {q.data?.length === limit && <button type="button" className={`${btn.ghost} mt-3`} onClick={() => setLimit((l) => l + 100)}>Load more</button>}
    </>
  );
}
