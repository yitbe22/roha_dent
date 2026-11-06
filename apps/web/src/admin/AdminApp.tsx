// /admin/* — staff dashboard. Client-only (served from app.html), lazy-loaded from App.tsx.
import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router';
import { Icon, type IconName } from '../components/Icon';
import { AuthProvider, useAuth } from './auth';
import { supabaseConfigured } from './supabase';
import { useLookups, usePendingCount, useRealtimeRefresh } from './data';
import { Centered, ConfirmProvider, ErrorBox, Loading, ToastProvider, btn, useToast } from './ui';
import { LoginPage, SetPasswordPage } from './pages/AuthPages';
import AppointmentsPage from './pages/Appointments';
import { AppointmentDrawer } from './pages/AppointmentDrawer';

const NewAppointmentPage = lazy(() => import('./pages/NewAppointment'));
const PatientsPage = lazy(() => import('./pages/Patients'));
const PatientDetailPage = lazy(() => import('./pages/PatientDetail'));
const SmsLogPage = lazy(() => import('./pages/SmsLog'));
const SchedulePage = lazy(() => import('./pages/Schedule'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const ClinicPage = lazy(() => import('./pages/Clinic'));
const StaffPage = lazy(() => import('./pages/Staff'));
const ActivityPage = lazy(() => import('./pages/Activity'));
const AccountPage = lazy(() => import('./pages/Account'));

export default function AdminApp() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Dashboard · Roha Dental';
    return () => {
      document.title = prev;
    };
  }, []);

  if (!supabaseConfigured) {
    return (
      <Centered>
        <ErrorBox error="Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in apps/web/.env.local." />
      </Centered>
    );
  }
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function Gate() {
  const auth = useAuth();
  if (!auth.ready) return <Centered><Loading /></Centered>;
  if (!auth.session) return <LoginPage />;
  if (auth.profile === undefined) return <Centered><Loading label="Opening your dashboard…" /></Centered>;
  if (auth.profileError || !auth.profile || !auth.profile.is_active) {
    return (
      <Centered>
        <h1 className="text-2xl">No access yet</h1>
        <p className="mt-2 text-ink-soft">
          {auth.profileError
            ? 'Your account could not be loaded. Check the internet connection and reload the page.'
            : `You are signed in as ${auth.session.user.email}, but this account has no dashboard access. Ask the clinic owner to give you access.`}
        </p>
        <button type="button" className={`${btn.ghost} mt-6`} onClick={auth.signOut}>Sign out</button>
      </Centered>
    );
  }
  if (auth.mustChangePassword) return <SetPasswordPage forced />;
  return <Shell />;
}

// ---- shell -------------------------------------------------------------------------------

type NavItem = { to: string; label: string; icon: IconName; end?: boolean };
const DAILY: NavItem[] = [
  { to: '/admin', label: 'Appointments', icon: 'calendar', end: true },
  { to: '/admin/patients', label: 'Patients', icon: 'users' },
  { to: '/admin/sms', label: 'Text messages', icon: 'message' },
  { to: '/admin/schedule', label: 'Working hours & days off', icon: 'clock' },
];
const OWNER: NavItem[] = [
  { to: '/admin/clinic', label: 'Dentists & services', icon: 'building' },
  { to: '/admin/staff', label: 'Staff accounts', icon: 'user' },
  { to: '/admin/settings', label: 'Settings & SMS texts', icon: 'settings' },
  { to: '/admin/activity', label: 'Change history', icon: 'activity' },
];

function Shell() {
  const auth = useAuth();
  const toast = useToast();
  const lookups = useLookups();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  useEffect(() => setMenuOpen(false), [pathname]);

  // Live: any appointment change refreshes lists; a new website booking pops a notice.
  useRealtimeRefresh('appointments', [['appointments'], ['appointment'], ['pending-count'], ['patient']], (row) => {
    if (row.source === 'online') toast('New booking request from the website', 'info');
  });
  useRealtimeRefresh('sms_log', [['sms'], ['appointment-sms']]);

  const pending = usePendingCount(auth.scope);

  const myLocation = lookups.data?.location(auth.profile?.location_id);
  const apptId = params.get('appt');

  const link = (n: NavItem) => (
    <NavLink key={n.to} to={n.to} end={n.end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${
          isActive ? 'bg-white text-roha-900' : 'text-roha-100 hover:bg-white/10'
        }`}>
      <Icon name={n.icon} className="size-5 shrink-0" />
      <span className="flex-1 leading-tight">{n.label}</span>
      {n.to === '/admin' && (pending.data ?? 0) > 0 && (
        <span className="rounded-full bg-adey px-2 text-sm font-bold text-roha-900" title="Requests waiting to be confirmed">{pending.data}</span>
      )}
    </NavLink>
  );

  const sidebar = (
    <div className="flex h-full flex-col gap-5 overflow-y-auto bg-roha-900 p-4 text-white">
      <div className="flex items-center gap-2.5 px-1">
        <span className="step-cross block size-8 bg-adey" aria-hidden="true" />
        <span className="leading-tight">
          <span className="block text-lg font-extrabold">Roha Dental</span>
          <span className="block text-sm text-roha-200">{auth.isOwner ? 'Both clinics' : `${myLocation?.city ?? ''} clinic`}</span>
        </span>
      </div>
      <NavLink to="/admin/new" className="btn-adey min-h-12">
        <Icon name="plus" className="size-5" /> New booking
      </NavLink>
      <nav aria-label="Dashboard" className="flex flex-col gap-5">
        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-roha-300 uppercase">Daily work</p>
          {DAILY.map(link)}
        </div>
        {auth.isOwner ? (
          <div className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-roha-300 uppercase">Owner</p>
            {OWNER.map(link)}
          </div>
        ) : (
          link({ to: '/admin/settings', label: 'SMS texts & rules', icon: 'settings' })
        )}
      </nav>
      <div className="mt-auto border-t border-white/10 pt-4">
        <p className="font-semibold">{auth.profile?.full_name}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <NavLink to="/admin/account" className="rounded-md px-2 py-1.5 text-sm text-roha-100 hover:bg-white/10">My account</NavLink>
          <button type="button" onClick={auth.signOut} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-roha-100 hover:bg-white/10">
            <Icon name="logout" className="size-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-enamel lg:grid lg:grid-cols-[16.5rem_1fr] lg:bg-[linear-gradient(to_right,var(--color-roha-900)_16.5rem,var(--color-enamel)_16.5rem)]">
      <aside className="sticky top-0 hidden h-dvh lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-roha-900 px-4 py-2 text-white lg:hidden">
        <button type="button" className="inline-flex items-center gap-2 rounded-md px-2 py-2 font-semibold hover:bg-white/10"
          aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          <Icon name={menuOpen ? 'close' : 'menu'} /> Menu
          {(pending.data ?? 0) > 0 && <span className="rounded-full bg-adey px-2 text-sm font-bold text-roha-900">{pending.data}</span>}
        </button>
        <NavLink to="/admin/new" className="btn-adey min-h-10 px-3 text-sm"><Icon name="plus" className="size-4" /> New booking</NavLink>
      </header>
      {menuOpen && <div className="fixed inset-0 top-14 z-20 lg:hidden">{sidebar}</div>}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          {lookups.isError ? (
            <ErrorBox error="Could not load the clinic information. Check the internet connection." onRetry={() => lookups.refetch()} />
          ) : !lookups.data ? (
            <Loading />
          ) : (
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route index element={<AppointmentsPage />} />
                <Route path="new" element={<NewAppointmentPage />} />
                <Route path="patients" element={<PatientsPage />} />
                <Route path="patients/:id" element={<PatientDetailPage />} />
                <Route path="sms" element={<SmsLogPage />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="account" element={<AccountPage />} />
                {auth.isOwner && <Route path="clinic" element={<ClinicPage />} />}
                {auth.isOwner && <Route path="staff" element={<StaffPage />} />}
                {auth.isOwner && <Route path="activity" element={<ActivityPage />} />}
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Routes>
            </Suspense>
          )}
        </div>
      </main>

      {lookups.data && (
        <AppointmentDrawer
          id={apptId}
          onClose={() => {
            const next = new URLSearchParams(params);
            next.delete('appt');
            setParams(next, { replace: true });
          }}
        />
      )}
    </div>
  );
}
