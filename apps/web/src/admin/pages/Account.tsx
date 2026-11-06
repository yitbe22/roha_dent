import { useAuth } from '../auth';
import { useLookups } from '../data';
import { Card, PageHeader } from '../ui';
import { PasswordForm } from './AuthPages';

export default function AccountPage() {
  const auth = useAuth();
  const { data: lk } = useLookups();
  return (
    <>
      <PageHeader title="Your account" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Profile">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-ink-soft">Name</dt><dd>{auth.profile?.full_name}</dd>
            <dt className="text-ink-soft">Email</dt><dd>{auth.session?.user.email}</dd>
            <dt className="text-ink-soft">Role</dt><dd className="capitalize">{auth.profile?.role}</dd>
            <dt className="text-ink-soft">Clinic</dt><dd>{lk?.location(auth.profile?.location_id)?.city ?? (auth.isOwner ? 'All clinics' : '—')}</dd>
          </dl>
          <p className="mt-4 text-xs text-ink-soft">Name, role and clinic are managed by the owner on the Staff page.</p>
        </Card>
        <Card title="Change password">
          <PasswordForm />
        </Card>
      </div>
    </>
  );
}
