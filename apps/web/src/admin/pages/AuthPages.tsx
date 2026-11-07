import { useState, type FormEvent } from 'react';
import { callFunction, supabase } from '../supabase';
import { errorMessage } from '../data';
import { useAuth } from '../auth';
import { Centered, ErrorBox, Field, btn, inputCls, useToast } from '../ui';

function Brand() {
  return (
    <div className="mb-8 flex items-center gap-3">
      <img src="/img/logo.png" alt="" width={141} height={160} className="h-10 w-auto" />
      <span className="leading-tight">
        <span className="block font-display text-lg font-semibold text-ink">Roha Dental</span>
        <span className="block text-sm text-ink-soft">Staff dashboard</span>
      </span>
    </div>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(
        /invalid login|invalid credentials/i.test(error.message)
          ? 'Wrong email or password.'
          : /banned/i.test(error.message)
            ? 'This account has been deactivated. Ask the clinic owner.'
            : error.message,
      );
    }
  }

  return (
    <Centered>
      <Brand />
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-white p-6">
        <h1 className="text-xl">Sign in</h1>
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <ErrorBox error={error} />}
        <button type="submit" className={`${btn.primary} w-full`} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-xs text-ink-soft">Forgot your password? Ask the clinic owner to reset it from the Staff page.</p>
      </form>
    </Centered>
  );
}

export function PasswordForm({ onDone }: { onDone?: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return setError('Use at least 10 characters.');
    if (pw !== pw2) return setError('The two passwords don’t match.');
    setBusy(true);
    setError(null);
    // Through the server, which enforces the length and clears the "must change password" flag.
    try {
      await callFunction('admin-users', { action: 'set_own_password', password: pw });
      await supabase.auth.refreshSession(); // pick up the cleared flag
    } catch (e) {
      setBusy(false);
      return setError(errorMessage(e));
    }
    setBusy(false);
    setPw('');
    setPw2('');
    toast('Password updated');
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="New password" hint="At least 10 characters. A short sentence is easy to remember.">
        <input className={inputCls} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label="Repeat new password">
        <input className={inputCls} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </Field>
      {error && <ErrorBox error={error} />}
      <button type="submit" className={btn.primary} disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
    </form>
  );
}

export function SetPasswordPage({ forced }: { forced?: boolean }) {
  const auth = useAuth();
  return (
    <Centered>
      <Brand />
      <div className="rounded-xl border border-line bg-white p-6">
        <h1 className="text-xl">Choose your password</h1>
        {forced && <p className="mt-1 mb-4 text-sm text-ink-soft">You signed in with a temporary password. Set your own to continue.</p>}
        <PasswordForm />
        <button type="button" className="link mt-6 text-sm" onClick={auth.signOut}>Sign out</button>
      </div>
    </Centered>
  );
}
