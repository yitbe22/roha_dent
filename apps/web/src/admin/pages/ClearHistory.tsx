import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../auth';
import { errorMessage } from '../data';
import { Modal, Tip, btn, inputCls, useConfirm, useToast } from '../ui';

export type HistoryKind = 'sms' | 'patients' | 'activity';

const COPY: Record<HistoryKind, { button: string; title: string; what: string; done: (n: number, a: number) => string }> = {
  sms: {
    button: 'Clear text history',
    title: 'Clear all text messages?',
    what: 'Every text message in this list is deleted. Messages still waiting to be sent are kept so they still go out.',
    done: (n) => `${n} text message${n === 1 ? '' : 's'} deleted`,
  },
  patients: {
    button: 'Clear all patients',
    title: 'Delete all patients and appointments?',
    what: 'Every patient and every appointment, past and upcoming, is deleted. Patients are not told. Use this to remove test data before you open.',
    done: (n, a) => `${n} patient${n === 1 ? '' : 's'} and ${a} appointment${a === 1 ? '' : 's'} deleted`,
  },
  activity: {
    button: 'Clear change history',
    title: 'Clear the change history?',
    what: 'Every entry in the change history is deleted. A single note that you cleared it is kept.',
    done: (n) => `${n} entr${n === 1 ? 'y' : 'ies'} deleted`,
  },
};

/** Owner-only "clear history" button (calls admin_clear_history, migration 0014). Hidden for staff. */
export function ClearHistoryButton({ kind }: { kind: HistoryKind }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const c = COPY[kind];

  const clear = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_clear_history', { p_what: kind });
      if (error) throw error;
      return data as { deleted: number; appointments_deleted: number };
    },
    onSuccess: (r) => {
      toast(c.done(r.deleted, r.appointments_deleted));
      setOpen(false);
      setTyped('');
      void qc.invalidateQueries();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  if (!auth.isOwner) return null;
  return (
    <>
      <button type="button" className={btn.danger} onClick={() => setOpen(true)}>{c.button}</button>
      <Modal open={open} onClose={() => { setOpen(false); setTyped(''); }} title={c.title}>
        <p className="text-ink-soft">{c.what}</p>
        <div className="mt-4"><Tip tone="warn">This cannot be undone.</Tip></div>
        <label className="mt-4 block text-sm font-medium">
          Type <b>DELETE</b> to confirm
          <input className={`${inputCls} mt-1.5`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
        </label>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={btn.danger} disabled={typed.trim() !== 'DELETE' || clear.isPending} onClick={() => clear.mutate()}>
            {clear.isPending ? 'Deleting…' : c.button}
          </button>
          <button type="button" className={btn.ghost} onClick={() => { setOpen(false); setTyped(''); }}>Go back</button>
        </div>
      </Modal>
    </>
  );
}

export const CLEARED_LABEL: Record<string, string> = { sms: 'text messages', patients: 'patients and appointments', activity: 'change history' };

// ---- select rows → "Delete selected" (admin_delete_history, migration 0015) ------------------

export type Selection = { ids: Set<string>; toggle: (id: string) => void; set: (ids: string[]) => void; clear: () => void };

export function useSelection(): Selection {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  return {
    ids,
    toggle: (id) => setIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    set: (list) => setIds(new Set(list)),
    clear: () => setIds(new Set()),
  };
}

/** Row checkbox, shown to the owner only. */
export function RowCheck({ sel, id, label }: { sel: Selection; id: string; label: string }) {
  const auth = useAuth();
  if (!auth.isOwner) return null;
  return (
    <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-roha-700" aria-label={`Select ${label}`}
      checked={sel.ids.has(id)} onChange={() => sel.toggle(id)} />
  );
}

const NOUN: Record<HistoryKind, [string, string]> = { sms: ['text message', 'text messages'], patients: ['patient', 'patients'], activity: ['entry', 'entries'] };

/**
 * Bar above a list (owner only): "Select all shown", and once something is ticked,
 * "Delete selected (n)" with a confirmation. Patients take their appointments with them.
 */
export function SelectionBar({ kind, sel, shownIds }: { kind: HistoryKind; sel: Selection; shownIds: string[] }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const ask = useConfirm();
  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.rpc('admin_delete_history', { p_what: kind, p_ids: ids });
      if (error) throw error;
      return data as { deleted: number; appointments_deleted: number };
    },
    onSuccess: (r) => {
      toast(COPY[kind].done(r.deleted, r.appointments_deleted));
      sel.clear();
      void qc.invalidateQueries();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  if (!auth.isOwner || shownIds.length === 0) return null;
  // Only rows that are ticked *and* still shown count, so a filter change never deletes hidden rows.
  const chosen = shownIds.filter((id) => sel.ids.has(id));
  const n = chosen.length;
  const allShown = n === shownIds.length;
  const [one, many] = NOUN[kind];
  return (
    <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white/95 px-3 py-2 backdrop-blur">
      <label className="flex min-h-9 cursor-pointer items-center gap-2 px-1 text-sm font-medium">
        <input type="checkbox" className="size-5 accent-roha-700" checked={allShown}
          onChange={() => (allShown ? sel.clear() : sel.set(shownIds))} />
        Select all shown
      </label>
      {n > 0 && (
        <>
          <span className="text-sm text-ink-soft">{n} selected</span>
          <button type="button" className={`${btn.danger} ml-auto min-h-9`} disabled={del.isPending}
            onClick={async () => {
              const ok = await ask({
                title: `Delete ${n} ${n === 1 ? one : many}?`,
                text: kind === 'patients'
                  ? 'Their appointments, past and upcoming, are deleted too. Patients are not told. This cannot be undone.'
                  : kind === 'sms'
                    ? 'Messages still waiting to be sent are kept so they still go out. This cannot be undone.'
                    : 'This cannot be undone.',
                yes: 'Delete',
                danger: true,
              });
              if (ok) del.mutate(chosen);
            }}>
            {del.isPending ? 'Deleting…' : `Delete selected (${n})`}
          </button>
          <button type="button" className={`${btn.ghost} min-h-9`} onClick={sel.clear}>Cancel</button>
        </>
      )}
    </div>
  );
}
