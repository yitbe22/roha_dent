import { Link } from 'react-router';
import { Seo } from '../lib/seo';
import { breadcrumbLd } from '../lib/schema';
import { locations } from '../content/locations';
import { PageIntro } from '../components/PageIntro';

// Small pages kept so existing URLs from the old sitemap keep working.

function Shell({ path, name, title, description, lede, children }: {
  path: string; name: string; title: string; description: string; lede: string; children: React.ReactNode;
}) {
  const crumbs = [{ name: 'Home', path: '/' }, { name, path }];
  return (
    <>
      <Seo title={title} description={description} path={path} jsonLd={[breadcrumbLd(crumbs)]} />
      <PageIntro crumbs={crumbs} title={title} lede={lede} />
      <div className="wrap mt-12 max-w-prose space-y-5 text-lg">{children}</div>
    </>
  );
}

export function Register() {
  return (
    <Shell path="/register" name="New patients" title="New patients"
      description="Becoming a patient at Roha Speciality Dental Center: no registration form needed. Book online or call."
      lede="You do not need to register in advance. Your patient record is created at your first booking.">
      <p>Book a time online with your name and phone number, or call the clinic. At your first visit we ask about your medical history and any medicines you take.</p>
      <p>Bring previous dental X-rays if you have them, and arrive about 10 minutes early.</p>
      <Link to="/book" className="btn-primary">Book your first visit</Link>
    </Shell>
  );
}

export function Careers() {
  return (
    <Shell path="/careers" name="Careers" title="Careers at Roha Dental"
      description="Work with Roha Speciality Dental Center in Addis Ababa or Gonder."
      lede="We are always glad to hear from dentists, dental nurses and front-desk staff.">
      <p>There are no open positions listed right now. To apply speculatively, call the clinic you would like to work at and ask for the clinic manager.</p>
      <ul className="space-y-2">
        {locations.map((l) => (
          <li key={l.slug}>{l.city}: <a href={`tel:${l.phoneE164}`} className="link">{l.phoneDisplay}</a></li>
        ))}
      </ul>
    </Shell>
  );
}

export function Events() {
  return (
    <Shell path="/events" name="Events" title="Events and free check-up days"
      description="Community dental check-up days and events from Roha Speciality Dental Center."
      lede="We run occasional free check-up days and school visits in Addis Ababa and Gonder.">
      <p>No events are scheduled at the moment. Upcoming dates will be listed here.</p>
    </Shell>
  );
}
