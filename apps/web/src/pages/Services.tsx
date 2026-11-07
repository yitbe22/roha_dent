import { Seo } from '../lib/seo';
import { breadcrumbLd } from '../lib/schema';
import { stagger } from '../lib/useReveal';
import { PageIntro } from '../components/PageIntro';
import { TreatmentGrid } from '../components/TreatmentGrid';
import { CtaBand } from '../components/CtaBand';

const promises = [
  ['An examination first', 'The dentist checks your teeth and gums, and takes an X-ray if it is needed.'],
  ['The price before treatment', 'You hear what the treatment costs and how many visits it takes, before anything starts.'],
  ['Your decision', 'Nothing is done without your agreement. You can take time to think, and book later.'],
] as const;

export default function Services() {
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Services', path: '/services' }];
  return (
    <>
      <Seo
        title="Dental Services in Addis Ababa & Gonder"
        description="Teeth cleaning, whitening, clear aligners and braces, root canal treatment, E.max and ceramic crowns, and removable dentures at Roha Speciality Dental Center."
        path="/services"
        jsonLd={[breadcrumbLd(crumbs)]}
      />
      <PageIntro
        crumbs={crumbs}
        title="Treatments"
        lede="From a routine cleaning to crowns and aligners. Open a treatment to see who it is for, what happens at the visit and how long it takes."
      />

      <section aria-label="All treatments" className="wrap mt-[clamp(2.5rem,5vw,4rem)]">
        <TreatmentGrid headingLevel="h2" />
      </section>

      <section aria-labelledby="how-h" className="wrap mt-[clamp(4rem,9vw,7.5rem)] grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <h2 id="how-h" data-reveal className="text-h2 max-w-[12ch]">How treatment works here</h2>
        <ol className="grid border-t border-line sm:grid-cols-3">
          {promises.map(([title, body], i) => (
            <li key={title} data-reveal style={stagger(i + 1)}
              className="border-b border-line py-6 sm:border-b-0 sm:border-l sm:px-6 sm:pt-6 sm:first:border-l-0 sm:first:pl-0">
              <span className="font-display text-[2.75rem] leading-none font-medium tracking-[-0.04em] text-sky tabular-nums">{i + 1}</span>
              <h3 className="mt-5 text-h3">{title}</h3>
              <p className="mt-2 text-[0.9375rem]">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <CtaBand title="Not sure which treatment?" body="Book a check-up and the dentist will explain your options and prices at the visit. Or call us and describe what you feel." />
    </>
  );
}
