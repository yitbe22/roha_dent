import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Seo } from '../lib/seo';
import { breadcrumbLd } from '../lib/schema';
import { bookingConfigured } from '../lib/api';
import { locations } from '../content/locations';
import { PageIntro } from '../components/PageIntro';
import { LocationPanel } from '../components/LocationPanel';

// Loaded only in the browser, so the wizard's code stays out of every other page.
const BookingWizard = lazy(() => import('../features/booking/BookingWizard'));

export default function Book() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Book', path: '/book' }];

  return (
    <>
      <Seo
        title="Book an Appointment"
        description="Book a dental appointment at Roha Speciality Dental Center in Addis Ababa or Gonder. Choose a time online and get SMS confirmation. Pay at the clinic."
        path="/book"
        jsonLd={[breadcrumbLd(crumbs)]}
      />
      <PageIntro
        crumbs={crumbs}
        title="Book an appointment"
        lede="Choose a clinic, treatment and time. We confirm by SMS, and you pay at the clinic."
      />
      <div className="wrap mt-10">
        {mounted && bookingConfigured ? (
          <Suspense fallback={<p className="text-ink-soft">{t('booking.loading')}</p>}>
            <BookingWizard />
          </Suspense>
        ) : (
          <>
            {mounted && <p className="mb-6 text-lede text-ink-soft">{t('booking.notConfigured')}</p>}
            {!mounted && <p className="mb-6 text-ink-soft">{t('booking.loading')}</p>}
            <div className="grid gap-6 md:grid-cols-2">
              {locations.map((l) => <LocationPanel key={l.slug} location={l} headingLevel="h2" />)}
            </div>
          </>
        )}
      </div>
    </>
  );
}
