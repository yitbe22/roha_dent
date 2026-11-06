import { Seo } from '../lib/seo';
import { breadcrumbLd, dentistLd } from '../lib/schema';
import { locations } from '../content/locations';
import { PageIntro } from '../components/PageIntro';
import { LocationPanel } from '../components/LocationPanel';

export default function Contact() {
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
        lede="Two clinics, the same standard of care. For urgent tooth pain, call the clinic directly so we can find you the earliest time."
      />
      <div className="wrap mt-12 grid gap-6 md:grid-cols-2">
        {locations.map((l) => <LocationPanel key={l.slug} location={l} headingLevel="h2" />)}
      </div>
    </>
  );
}
