import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '../supabase';
import { useAuth } from '../auth';
import { errorMessage, useLookups } from '../data';
import type { Profile, Role } from '../types';
import { Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader, btn, fmtRelative, inputCls, inputInline, useConfirm, useToast } from '../ui';

type StaffRow = Profile & { email: string | null; last_sign_in_at: string | null; must_change_password: boolean; created_at: string };

export default function StaffPage() {
  const auth = useAuth();
  const { data: lk } = useLookups();
  const toast = useToast();
  const qc = useQueryClient();
  const ask = useConfirm();
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);

  const list = useQuery({
    queryKey: ['staff'],
    queryFn: () => callFunction<{ staff: StaffRow[] }>('admin-users', { action: 'list' }).then((r) => r.staff),
  });
  const update = useMutation({
    mutationFn: (patch: { id: string } & Partial<Pick<Profile, 'role' | 'location_id' | 'is_active'>>) =>
      callFunction('admin-users', { action: 'update', ...patch }),
    onSuccess: () => {
      toast('Saved');
      qc.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const reset = useMutation({
    mutationFn: (row: StaffRow) => callFunction<{ tempPassword: string }>('admin-users', { action: 'reset_password', id: row.id }),
    onSuccess: (r, row) => {
      setSecret({ email: row.email ?? '', password: r.tempPassword });
      qc.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  const remove = useMutation({
    mutationFn: (row: StaffRow) => callFunction('admin-users', { action: 'delete', id: row.id }),
    onSuccess: (_r, row) => {
      toast(`${row.full_name}'s account was deleted`);
      qc.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  return (
    <>
      <PageHeader title="Staff accounts" subtitle="Who can use this dashboard. Staff only see their own clinic. Owners see everything." />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div>
          {list.isError ? (
            <ErrorBox error={errorMessage(list.error)} onRetry={() => list.refetch()} />
          ) : list.isPending ? (
            <Loading />
          ) : list.data.length === 0 ? (
            <Empty>No accounts yet.</Empty>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
              {list.data.map((s) => {
                const self = s.id === auth.profile?.id;
                return (
                  <li key={s.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${s.is_active ? '' : 'bg-enamel opacity-70'}`}>
                    <div className="min-w-48 flex-1">
                      <p className="font-semibold">{s.full_name}{self && <span className="ml-2 text-xs text-ink-soft">(you)</span>}</p>
                      <p className="text-xs text-ink-soft">
                        {s.email} · {s.last_sign_in_at ? `last sign-in ${fmtRelative(s.last_sign_in_at)}` : 'never signed in'}
                        {s.must_change_password && ' · temporary password'}
                      </p>
                    </div>
                    <select className={`${inputInline} w-auto`} value={s.role} disabled={self || update.isPending} aria-label="Role"
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        update.mutate({ id: s.id, role, ...(role === 'staff' && !s.location_id ? { location_id: lk?.locations[0]?.id ?? null } : {}) });
                      }}>
                      <option value="staff">Staff</option>
                      <option value="owner">Owner</option>
                    </select>
                    <select className={`${inputInline} w-auto`} value={s.location_id ?? ''} disabled={update.isPending} aria-label="Clinic"
                      onChange={(e) => update.mutate({ id: s.id, location_id: e.target.value || null })}>
                      {s.role === 'owner' && <option value="">All clinics</option>}
                      {lk?.locations.map((l) => <option key={l.id} value={l.id}>{l.city}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button type="button" className={btn.small} disabled={reset.isPending}
                        onClick={async () => { if (await ask({ title: `New password for ${s.full_name}?`, text: 'Their current password stops working. You will see a temporary password to give them.', yes: 'Make new password' })) reset.mutate(s); }}>
                        Reset password
                      </button>
                      {!self && (
                        <button type="button" className={btn.small} disabled={update.isPending}
                          onClick={async () => { if (!s.is_active || await ask({ title: `Deactivate ${s.full_name}?`, text: 'They will not be able to sign in any more. You can reactivate them later.', yes: 'Deactivate', danger: true })) update.mutate({ id: s.id, is_active: !s.is_active }); }}>
                          {s.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                      {!self && !s.is_active && (
                        <button type="button" className={`${btn.small} text-red-700 hover:bg-red-50`} disabled={remove.isPending}
                          onClick={async () => {
                            if (await ask({
                              title: `Delete ${s.full_name}'s account permanently?`,
                              text: 'Their sign-in and profile are removed for good. Bookings and texts they handled stay. In the change history their past actions will show as “Staff”. This cannot be undone.',
                              yes: 'Delete permanently',
                              danger: true,
                            })) remove.mutate(s);
                          }}>
                          Delete permanently
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <NewStaff onCreated={(email, password) => setSecret({ email, password })} />
      </div>

      <Modal open={!!secret} onClose={() => setSecret(null)} title="Temporary password">
        {secret && (
          <div className="space-y-4 text-sm">
            <p>Give these sign-in details to the person directly (not by SMS). They must choose their own password when they first sign in.</p>
            <dl className="grid grid-cols-[6rem_1fr] gap-y-2 rounded-lg bg-enamel p-3">
              <dt className="text-ink-soft">Address</dt><dd className="font-mono">{window.location.origin}/admin</dd>
              <dt className="text-ink-soft">Email</dt><dd className="font-mono">{secret.email}</dd>
              <dt className="text-ink-soft">Password</dt><dd className="font-mono text-base font-bold tracking-wide">{secret.password}</dd>
            </dl>
            <div className="flex gap-2">
              <button type="button" className={btn.primary} onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/admin\n${secret.email}\n${secret.password}`).then(() => toast('Copied'), () => {});
              }}>Copy</button>
              <button type="button" className={btn.ghost} onClick={() => setSecret(null)}>Done</button>
            </div>
            <p className="text-xs text-ink-soft">This password is shown only once.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

function NewStaff({ onCreated }: { onCreated: (email: string, password: string) => void }) {
  const { data: lk } = useLookups();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [locationId, setLocationId] = useState(lk?.locations[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => callFunction<{ id: string; tempPassword: string }>('admin-users', {
      action: 'create', email, full_name: name, role, location_id: locationId || null,
    }),
    onSuccess: (r) => {
      onCreated(email.trim().toLowerCase(), r.tempPassword);
      setEmail('');
      setName('');
      setError(null);
      qc.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <Card title="Add a person">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Full name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></Field>
        <Field label="Email" hint="Used to sign in. No email is sent."><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Role">
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="staff">Staff — one clinic</option>
            <option value="owner">Owner — everything</option>
          </select>
        </Field>
        <Field label="Clinic">
          <select className={inputCls} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {role === 'owner' && <option value="">All clinics</option>}
            {lk?.locations.map((l) => <option key={l.id} value={l.id}>{l.city}</option>)}
          </select>
        </Field>
        {error && <ErrorBox error={error} />}
        <button type="submit" className={`${btn.primary} w-full`} disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create account'}</button>
      </form>
    </Card>
  );
}
