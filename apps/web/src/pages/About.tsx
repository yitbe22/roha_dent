import { Link } from 'react-router';
import { Seo } from '../lib/seo';
import { breadcrumbLd } from '../lib/schema';
import { stagger } from '../lib/useReveal';
import { IntroPhoto, PageIntro } from '../components/PageIntro';
import { Button } from '@/components/ui/button';

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
        title="About Roha"
        lede="A dental practice with clinics in Addis Ababa and Gonder, bringing general and specialist care together in one place."
        media={<IntroPhoto src="/img/clinic-room.webp" alt="A Roha treatment room with a blue and white dental chair" width={667} height={889} />}
      />

      <section aria-labelledby="story-h" className="wrap mt-[clamp(3rem,7vw,6rem)] grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <h2 id="story-h" data-reveal className="text-h2 max-w-[10ch]">Why “Roha”</h2>
        <div data-reveal style={stagger(1)} className="flex max-w-[40rem] flex-col gap-5 text-lg leading-relaxed text-ink">
          <p>
            Roha is the old name of Lalibela, where churches were carved from a single piece of rock. We chose it as a reminder
            of patient, careful work that lasts.
          </p>
          <p>
            Our team covers preventive care, cosmetic treatment, root canal therapy, crowns, dentures and orthodontics. Our
            orthodontist works at both clinics during the week, so patients in Gonder and Addis Ababa get the same options.
          </p>
        </div>
      </section>

      <section aria-labelledby="commit-h" className="wrap mt-[clamp(4rem,9vw,7.5rem)]">
        <div className="on-blue rounded-panel bg-roha-700 p-[clamp(1.5rem,5vw,4rem)] text-white">
          <h2 id="commit-h" data-reveal className="text-h2 max-w-[14ch] text-white">What you can expect</h2>
          <dl className="mt-[clamp(2rem,4vw,3rem)] grid sm:grid-cols-2 lg:grid-cols-4">
            {commitments.map(([title, body], i) => (
              <div key={title} data-reveal style={stagger(i + 1)}
                className="border-t border-white/25 py-6 lg:border-t-0 lg:border-l lg:px-6 lg:py-1 lg:first:border-l-0 lg:first:pl-0">
                <dt className="before:mb-5 before:block before:h-0.5 before:w-7 before:rounded-full before:bg-adey before:content-[''] font-display text-xl leading-tight text-white">{title}</dt>
                <dd className="mt-3 text-[0.9375rem] text-white/85">{body}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild variant="inverse"><Link to="/book">Book appointment</Link></Button>
            <Button asChild variant="inverse-outline"><Link to="/doctors">Meet the dentists</Link></Button>
          </div>
        </div>
      </section>

    </>
  );
}
