import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Seo } from '../lib/seo';

const ManageBooking = lazy(() => import('../features/booking/ManageBooking'));

/** /booking/:token — client-only (served from app.html, never prerendered, noindex). */
export default function ManageBookingPage() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('manage.title')} path="/booking" noindex />
      <div className="wrap py-10 sm:py-14">
        <h1 className="text-h1">{t('manage.title')}</h1>
        <div className="mt-8">
          <Suspense fallback={<p className="text-ink-soft">{t('manage.loading')}</p>}>
            <ManageBooking />
          </Suspense>
        </div>
      </div>
    </>
  );
}
