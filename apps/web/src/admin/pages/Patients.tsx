import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { errorMessage } from '../data';
import type { Patient } from '../types';
import { Empty, ErrorBox, Loading, PageHeader, Phone, fmtDateTime, inputCls, useDebounced } from '../ui';
import { Icon } from '../../components/Icon';

export default function PatientsPage() {
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 300);

  const res = useQuery({
    queryKey: ['patients', q],
    queryFn: async () => {
      let query = supabase.from('patients').select('id, full_name, phone, email, notes, created_at').limit(50);
      if (q) {
        // strip characters that have meaning in PostgREST filter syntax
        const safe = q.replace(/[,()*%\\:"']/g, ' ').trim();
        const digits = safe.replace(/\D/g, '').replace(/^0/, '');
        const ors = [`full_name.ilike.*${safe}*`];
        if (digits.length >= 3) ors.push(`phone.ilike.*${digits}*`);
        query = query.or(ors.join(',')).order('full_name');
      } else {
        query = query.order('updated_at', { ascending: false });
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Patient[];
    },
  });

  return (
    <>
      <PageHeader title="Patients" subtitle="Everyone who has booked at your clinic. One record per phone number." />
      <div className="relative mb-4 max-w-md">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
        <input className={`${inputCls} pl-9`} type="search" placeholder="Search name or phone…" value={text}
          onChange={(e) => setText(e.target.value)} aria-label="Search patients" />
      </div>
      {res.isError ? (
        <ErrorBox error={errorMessage(res.error)} onRetry={() => res.refetch()} />
      ) : res.isPending ? (
        <Loading />
      ) : res.data.length === 0 ? (
        <Empty>{q ? 'No patient matches that search.' : 'No patients yet.'}</Empty>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {res.data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-roha-50/60">
              <Link to={`/admin/patients/${p.id}`} className="min-w-48 flex-1 font-semibold text-roha-900 hover:underline">{p.full_name}</Link>
              <Phone e164={p.phone} />
              <span className="text-xs text-ink-soft">since {fmtDateTime(p.created_at)}</span>
              {p.notes && <span className="w-full truncate text-xs text-ink-soft">{p.notes}</span>}
            </li>
          ))}
        </ul>
      )}
      {res.data?.length === 50 && <p className="mt-2 text-xs text-ink-soft">Showing the first 50 — refine the search to find others.</p>}
    </>
  );
}
