import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Icon, type IconName } from '../components/Icon';
import { formatEthiopianPhone } from '@shared/phone.ts';
import type { AppointmentStatus, SmsStatus } from './types';
import { STATUS_LABEL, smsState } from './types';

// Controls are sized for touch and for people who are not computer experts:
// big targets, clear labels, one obvious main action.
export const btn = {
  primary: 'btn-primary min-h-11 px-5 text-[0.95rem] disabled:opacity-50',
  ghost: 'btn-ghost min-h-11 px-4 text-[0.95rem] disabled:opacity-50',
  danger: 'btn min-h-11 px-4 text-[0.95rem] border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50',
  small: 'btn-ghost min-h-9 px-3 text-sm disabled:opacity-50',
};
const inputBase =
  'block rounded-lg border border-line bg-white px-3 py-2.5 text-base text-ink placeholder:text-ink-soft/60 disabled:bg-mist/50 disabled:text-ink-soft aria-[invalid=true]:border-red-500';
/** Full-width input (forms). */
export const inputCls = `${inputBase} w-full`;
/** Inline input whose width you set (filters, toolbars). */
export const inputInline = inputBase;

// ---- layout bits -------------------------------------------------------------------------

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, step, actions, children, className = '' }: { title?: string; step?: number; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          {title && (
            <h2 className="flex items-center gap-2.5 text-lg font-bold text-roha-900">
              {step !== undefined && (
                <span className="grid size-7 place-items-center rounded-full bg-roha-700 text-sm text-white">{step}</span>
              )}
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Field({ label, hint, error, children, className = '' }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block font-semibold text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-sm text-ink-soft">{hint}</span>}
      {error && <span className="mt-1 block text-sm font-medium text-red-700">{error}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2.5">
      <input type="checkbox" className="size-5 accent-roha-700" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** Big two-or-more option picker (clearer than a dropdown for small choices). */
export function Choice<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; label: string; options: { value: T; title: string; text?: string }[];
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 font-semibold text-ink">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value}
            className={`flex cursor-pointer gap-3 rounded-lg border-2 px-3 py-2.5 transition-colors ${
              value === o.value ? 'border-roha-700 bg-roha-50' : 'border-line bg-white hover:border-roha-300'
            }`}>
            <input type="radio" className="mt-1 size-4 accent-roha-700" checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>
              <span className="block font-semibold">{o.title}</span>
              {o.text && <span className="block text-sm text-ink-soft">{o.text}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p className="py-8 text-ink-soft" aria-live="polite">{label}</p>;
}

export function Empty({ children, icon = 'check' }: { children: ReactNode; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-white px-4 py-10 text-center text-ink-soft">
      <Icon name={icon} className="size-7 text-roha-300" />
      <div>{children}</div>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
      <Icon name="alert" className="size-5" />
      <span>{error}</span>
      {onRetry && <button type="button" className="link" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/** Friendly explanation box. */
export function Tip({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div className={`flex gap-3 rounded-lg px-4 py-3 ${tone === 'warn' ? 'bg-adey-soft text-[#5c3f00]' : 'bg-roha-50 text-roha-900'}`}>
      <Icon name={tone === 'warn' ? 'alert' : 'info'} className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

export function Phone({ e164 }: { e164: string }) {
  return (
    <a href={`tel:${e164}`} className="whitespace-nowrap tabular-nums text-roha-700 hover:underline">
      {formatEthiopianPhone(e164)}
    </a>
  );
}

export function CallButton({ e164, small }: { e164: string; small?: boolean }) {
  return (
    <a href={`tel:${e164}`} className={small ? btn.small : btn.ghost} title={`Call ${formatEthiopianPhone(e164)}`}>
      <Icon name="phone" className="size-4" /> <span className="tabular-nums">{formatEthiopianPhone(e164)}</span>
    </a>
  );
}

// ---- badges ------------------------------------------------------------------------------

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending: 'bg-adey text-roha-900 ring-[#d9a52e]',
  confirmed: 'bg-roha-100 text-roha-800 ring-roha-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
  no_show: 'bg-red-50 text-red-700 ring-red-200',
};
export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export const SMS_PROBLEM: SmsStatus[] = ['failed', 'rejected', 'undelivered', 'expired'];
export function SmsBadge({ status }: { status: SmsStatus }) {
  const s = smsState(status);
  const cls = {
    ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    wait: 'bg-roha-50 text-roha-700 ring-roha-200',
    bad: 'bg-red-50 text-red-700 ring-red-200',
    off: 'bg-slate-100 text-slate-600 ring-slate-200',
  }[s.tone];
  return (
    <span title={s.help} className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset ${cls}`}>
      {s.label}
    </span>
  );
}

// ---- drawer / modal (native <dialog>: focus trap, Esc, inert background) -------------------

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Dialog open={open} onClose={onClose}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-xl overflow-y-auto border-l border-line bg-enamel p-0 text-ink shadow-2xl backdrop:bg-roha-900/40">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-3">
        <h2 className="truncate text-xl">{title}</h2>
        <button type="button" className={btn.ghost} onClick={onClose}>
          <Icon name="close" className="size-4" /> Close
        </button>
      </div>
      <div className="p-5">{children}</div>
    </Dialog>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Dialog open={open} onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-roha-900/40">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-xl">{title}</h2>
        <button type="button" className="btn-ghost min-h-9 px-2" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </Dialog>
  );
}

function Dialog({ open, onClose, className, children }: { open: boolean; onClose: () => void; className: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={className}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
    >
      {open && children}
    </dialog>
  );
}

// ---- "Are you sure?" dialog (replaces window.confirm) ---------------------------------------

type Ask = { title: string; text?: ReactNode; yes: string; no?: string; danger?: boolean };
const ConfirmCtx = createContext<(a: Ask) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<(Ask & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((a: Ask) => new Promise<boolean>((resolve) => setAsk({ ...a, resolve })), []);
  const done = (v: boolean) => {
    ask?.resolve(v);
    setAsk(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!ask} onClose={() => done(false)} title={ask?.title ?? ''}>
        {ask?.text && <div className="mb-5 text-ink-soft">{ask.text}</div>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ask?.danger ? btn.danger : btn.primary} onClick={() => done(true)} autoFocus>{ask?.yes}</button>
          <button type="button" className={btn.ghost} onClick={() => done(false)}>{ask?.no ?? 'Go back'}</button>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);

// ---- toasts ------------------------------------------------------------------------------

type Toast = { id: number; text: string; tone: 'ok' | 'error' | 'info' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 9000 : 5000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto flex max-w-lg items-center gap-2 rounded-xl px-5 py-3 font-medium shadow-lg ${
              t.tone === 'error' ? 'bg-red-700 text-white' : t.tone === 'info' ? 'bg-adey text-roha-900' : 'bg-roha-900 text-white'
            }`}>
            <Icon name={t.tone === 'error' ? 'alert' : 'check'} className="size-5 shrink-0" />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ---- misc --------------------------------------------------------------------------------

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
}

export function fmtRelative(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDateTime(iso);
}

export function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-enamel px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

/** Opens the appointment drawer from anywhere (?appt=<id>, keeps other query params). */
export function useOpenAppointment() {
  const [params, setParams] = useSearchParams();
  return (id: string) => {
    const next = new URLSearchParams(params);
    next.set('appt', id);
    setParams(next);
  };
}
