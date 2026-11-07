import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Seo } from '../lib/seo';
import { breadcrumbLd } from '../lib/schema';
import { bookingConfigured } from '../lib/api';
import { locations } from '../content/locations';
import { stagger } from '../lib/useReveal';
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
      <header className="wrap pt-[clamp(2.5rem,6vw,4.5rem)] text-center">
        <p data-reveal className="text-xs font-medium tracking-[0.14em] text-roha-700 uppercase">{t('booking.form.eyebrow')}</p>
        <h1 data-reveal style={stagger(1)} className="mt-4 text-h2">{t('booking.form.title')}</h1>
        <p data-reveal style={stagger(2)} className="mx-auto mt-4 max-w-[52ch]">{t('booking.form.lede')}</p>
      </header>
      <div className="wrap mt-[clamp(2rem,5vw,3.5rem)]">
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
