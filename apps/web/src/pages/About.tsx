import { Link } from 'react-router';
import { Seo } from '../lib/seo';
import { breadcrumbLd } from '../lib/schema';
import { PageIntro } from '../components/PageIntro';

const commitments = [
  ['You understand before we treat', 'The dentist explains what they see, your options and the cost. Treatment starts only when you agree.'],
  ['Sterile, single-use where it matters', 'Instruments are sterilised for every patient, and needles, gloves and suction tips are single-use.'],
  ['Specialists under one roof', 'General dentistry, root canal treatment, crowns and orthodontics, so you are not sent elsewhere.'],
  ['Time you can rely on', 'Booked times are kept free for you. We send a reminder the day before and two hours before.'],
] as const;

export default function About() {
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }];
  return (
    <>
      <Seo
        title="About Us"
        description="Roha Speciality Dental Center provides general and specialist dental care in Addis Ababa and Gonder, Ethiopia."
        path="/about"
        jsonLd={[breadcrumbLd(crumbs)]}
      />
      <PageIntro
        crumbs={crumbs}
        title="About Roha Speciality Dental Center"
        lede="We are a dental practice with clinics in Addis Ababa and Gonder, bringing general and specialist care together in one place."
      />
      <div className="wrap mt-14 grid gap-14 lg:grid-cols-[1fr_1fr]">
        <div className="max-w-prose space-y-5 text-lg">
          <p>
            Roha is the old name of Lalibela, where churches were carved from a single piece of rock. We chose it as a reminder
            of patient, careful work that lasts.
          </p>
          <p>
            Our team covers preventive care, cosmetic treatment, root canal therapy, crowns, dentures and orthodontics. Our
            orthodontist works at both clinics during the week, so patients in Gonder and Addis Ababa get the same options.
          </p>
          <p className="text-ink-soft">
            (Placeholder text. Replace with the clinic’s own story, founding year and team photos.)
          </p>
        </div>
        <section aria-labelledby="commit-h">
          <h2 id="commit-h" className="text-h2">What you can expect</h2>
          <dl className="mt-6 space-y-6">
            {commitments.map(([title, body]) => (
              <div key={title} className="border-l-4 border-adey pl-5">
                <dt className="text-lg font-bold text-roha-900">{title}</dt>
                <dd className="mt-1 text-ink-soft">{body}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/doctors" className="btn-ghost">Meet the dentists</Link>
            <Link to="/book" className="btn-primary">Book appointment</Link>
          </div>
        </section>
      </div>
    </>
  );
}
