import { useTranslation } from 'react-i18next';
import { Phone } from 'lucide-react';
import { Seo } from '../lib/seo';
import { breadcrumbLd, dentistLd } from '../lib/schema';
import { stagger } from '../lib/useReveal';
import { locations } from '../content/locations';
import { IntroPhoto, PageIntro } from '../components/PageIntro';
import { LocationPanel } from '../components/LocationPanel';
import { Button } from '@/components/ui/button';

export default function Contact() {
  const { t } = useTranslation();
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Locations', path: '/contact' }];
  return (
    <>
      <Seo
        title="Contact & Locations"
        description="Phone numbers, WhatsApp, directions and opening hours for Roha Speciality Dental Center in Addis Ababa and Gonder."
        path="/contact"
        jsonLd={[breadcrumbLd(crumbs), ...locations.map(dentistLd)]}
      />
      <PageIntro
        crumbs={crumbs}
        title="Our clinics"
        lede="Two clinics with the same standard of care, open Monday to Saturday. Call, message us on WhatsApp, or book online."
        media={<IntroPhoto src="/img/clinic-hallway.webp" alt="The treatment rooms along the hallway at Roha Dental" width={1284} height={856} />}
      />

      <div className="wrap mt-[clamp(2.5rem,5vw,4rem)] grid gap-4 md:grid-cols-2">
        {locations.map((l, i) => (
          <div key={l.slug} data-reveal style={stagger(i)} className="grid">
            <LocationPanel location={l} headingLevel="h2" />
          </div>
        ))}
      </div>

      <section aria-labelledby="urgent-h" className="wrap mt-[clamp(3rem,7vw,5rem)]">
        <div data-reveal className="grid gap-6 rounded-panel bg-page p-[clamp(1.5rem,4vw,2.75rem)] ring-1 ring-line lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <h2 id="urgent-h" className="text-[clamp(1.5rem,2.6vw,2rem)] leading-tight">Tooth pain or a broken tooth?</h2>
            <p className="mt-3 max-w-[46ch]">Call the clinic instead of booking online. We will find you the earliest time we can, often the same day.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
            {locations.map((l) => (
              <Button key={l.slug} asChild variant="solid">
                <a href={`tel:${l.phoneE164}`}><Phone data-icon="inline-start" />{t('cta.callCity', { city: l.city })}</a>
              </Button>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
