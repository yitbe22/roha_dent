import { Fragment, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Seo } from '../lib/seo';
import { organizationLd, dentistLd, websiteLd } from '../lib/schema';
import { locations } from '../content/locations';
import { services } from '../content/services';
import { dentists } from '../content/dentists';
import { faqGroups } from '../content/faq';
import { LocationPanel } from '../components/LocationPanel';
import { TreatmentGrid } from '../components/TreatmentGrid';
import { BeforeAfter } from '../components/BeforeAfter';
import { beforeAfterCases } from '../content/beforeAfter';
import { CalendarDays, MapPin } from 'lucide-react';
import { DentistAvatar } from '../components/DentistAvatar';
import { HeroTooth } from '../components/hero/HeroTooth';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { stagger } from '../lib/useReveal';
import { useGrowPanel } from '../lib/scrollFx';
import { CtaBand } from '../components/CtaBand';
import { CountUp } from '../components/CountUp';

const HERO_TITLE = 'Your smile starts here.';
const HERO_RIGHT = ['Designed', 'with you', 'in mind'];
const MARQUEE = 'Roha Speciality Dental Center — Addis Ababa · Gonder —';

function SectionHead({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div data-reveal className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <h2 id={id} className="text-h2 max-w-[18ch]">{title}</h2>
      {children}
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const faqPreview = faqGroups[0].items.slice(0, 3);
  const aboutPanel = useRef<HTMLDivElement>(null);
  const aboutBg = useRef<HTMLImageElement>(null);
  useGrowPanel(aboutPanel, aboutBg);
  const facts = [
    { value: String(locations.length), label: 'Clinics, in Addis Ababa and Gonder' },
    { value: String(services.length), label: 'Treatments, from cleaning to crowns' },
    { value: 'Mon–Sat', label: 'Open 8:30 – 17:30 at both clinics' },
    { value: 'SMS', label: 'Your booking is confirmed by text' },
  ];

  return (
    <>
      <Seo
        title="Roha Dental | Dentist in Addis Ababa & Gonder"
        description="Teeth cleaning, whitening, clear aligners, root canal treatment, crowns and dentures in Addis Ababa and Gonder. Book online in a minute or call the clinic."
        path="/"
        jsonLd={[websiteLd(), organizationLd(), ...locations.map(dentistLd)]}
      />

      {/* Hero: headline | glass tooth | "Designed with you in mind", then the name marquee (as in the reference) */}
      <section id="top" className="hero overflow-hidden pt-[clamp(0.5rem,2vw,1.5rem)]">
        <div className="wrap grid items-center lg:min-h-[min(36rem,70vh)] lg:grid-cols-[1fr_minmax(16rem,1.05fr)_1fr] lg:gap-2">
          <div className="relative z-10 grid gap-[1.625rem]">
            <h1 className="text-[clamp(2.5rem,5.4vw,4.75rem)] leading-[0.98]">
              {HERO_TITLE.split(' ').map((w, i) => (
                <Fragment key={i}>{i > 0 && ' '}<span data-intro style={{ '--i': i } as CSSProperties}>{w}</span></Fragment>
              ))}
            </h1>
            <p data-intro="fade" style={{ '--i': 0 } as CSSProperties} className="max-w-[34ch] text-[0.9375rem]">
              Check-ups, cleaning, braces, crowns and root canal treatment at our Addis Ababa and Gonder clinics.
            </p>
            <ul data-intro="fade" style={{ '--i': 1 } as CSSProperties} className="flex flex-wrap gap-2" aria-label="Clinics">
              {locations.map((l) => (
                <li key={l.slug}>
                  <Link to={`/locations/${l.slug}`} className="chip inline-flex items-center gap-2 text-xs hover:border-sky"><span className="size-1.5 rounded-full bg-adey" aria-hidden="true" />{l.city}</Link>
                </li>
              ))}
              <li><Link to="/services" className="chip inline-flex text-xs hover:border-sky">{services.length} treatments</Link></li>
            </ul>
          </div>
          <div data-intro="tooth" className="-mt-2.5 -mb-5 max-lg:order-first lg:my-0">
            <HeroTooth />
          </div>
          <div className="relative z-10 mt-7 grid justify-items-start gap-[1.375rem] lg:mt-0">
            <h2 className="text-[clamp(2rem,3.6vw,3.25rem)] leading-none">
              {HERO_RIGHT.map((w, i) => (
                <Fragment key={i}>{i > 0 && ' '}<span data-intro="dim" style={{ '--i': i } as CSSProperties}>{w}</span></Fragment>
              ))}
            </h2>
            <Link to="/book" data-intro="fade" style={{ '--i': 2 } as CSSProperties} className="btn-primary min-h-11 pl-2 text-[0.9375rem]">
              <span className="btn-ic"><CalendarDays className="size-4" aria-hidden="true" /></span>
              {t('cta.book')}
            </Link>
          </div>
        </div>
        <div className="marquee" aria-hidden="true">
          <div>{MARQUEE}&nbsp;</div><div>{MARQUEE}&nbsp;</div>
        </div>
      </section>

      {/* About: the clinic itself */}
      <section id="about" aria-labelledby="about-h" className="wrap">
        <div ref={aboutPanel} className="on-blue relative isolate flex min-h-[36rem] origin-center flex-col justify-between overflow-hidden rounded-panel text-white will-change-transform">
          <img ref={aboutBg} src="/img/clinic-hallway.webp" alt="" width={1284} height={856} loading="lazy"
            className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(29_62_130/0.9)_0%,rgb(42_82_158/0.66)_50%,rgb(25_55_120/0.9)_100%)]" aria-hidden="true" />
          <div className="max-w-2xl p-[clamp(1.5rem,4vw,2.75rem)]">
            <h2 id="about-h" data-reveal className="text-h2 max-w-[15ch] text-white">Two clinics, one way of caring for you</h2>
            <p data-reveal style={stagger(1)} className="mt-5 max-w-[46ch] text-white/90">
              Roha Speciality Dental Center cares for families in Addis Ababa and Gonder. Every visit starts with an examination, so your dentist can explain what is needed, your options and what to expect before treatment begins.
            </p>
            <div data-reveal style={stagger(2)}><Button asChild variant="inverse-outline" className="mt-7"><Link to="/about">About Roha</Link></Button></div>
          </div>
          <dl className="grid grid-cols-2 bg-roha-900 lg:grid-cols-4">
            {facts.map((f, i) => (
              <div key={f.label} data-reveal style={stagger(i + 2)}
                className="flex flex-col-reverse justify-end border-white/15 px-[clamp(1.25rem,3vw,2.75rem)] py-6 odd:border-r max-lg:nth-[n+3]:border-t lg:border-r lg:last:border-r-0 sm:py-8">
                <dt className="mt-2 max-w-[22ch] text-sm text-white/80">{f.label}</dt>
                <dd className="before:mb-5 before:block before:h-0.5 before:w-7 before:rounded-full before:bg-adey before:content-[''] font-display text-[clamp(1.625rem,3.6vw,3rem)] leading-none font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums"><CountUp value={f.value} /></dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Clinics */}
      <section id="clinics" aria-labelledby="clinics-h" className="wrap section-y">
        <SectionHead id="clinics-h" title="Choose your clinic" />
        <p data-reveal style={stagger(1)} className="mt-4 max-w-2xl">
          Both clinics are open Monday to Saturday. Call, message us on WhatsApp, or book a time online.
        </p>
        <div className="mt-[clamp(1.75rem,4vw,3rem)] grid gap-4 md:grid-cols-2">
          {locations.map((l, i) => (
            <div key={l.slug} data-reveal style={stagger(i + 2)} className="grid">
              <LocationPanel location={l} />
            </div>
          ))}
        </div>
      </section>

      {/* Treatments */}
      <section id="treatments" aria-labelledby="services-h" className="section-y bg-page">
        <div className="wrap">
          <SectionHead id="services-h" title="Treatments">
            <Link to="/services" className="link">{t('cta.allServices')}</Link>
          </SectionHead>
          <p data-reveal style={stagger(1)} className="mt-4 max-w-2xl">
            Every treatment starts with an examination. The dentist explains what your teeth need and the price before anything is done.
          </p>
          <div className="mt-[clamp(1.75rem,4vw,3rem)]">
            <TreatmentGrid />
          </div>
        </div>
      </section>

      {/* Before and after (illustrative until real, consented cases replace it) */}
      {beforeAfterCases.length > 0 && (
        <section id="before-and-after" aria-labelledby="ba-h" className="wrap section-y grid items-center gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div data-reveal>
            <h2 id="ba-h" className="text-h2 max-w-[14ch]">{t('beforeAfter.heading')}</h2>
            <p className="mt-5 max-w-md">
              <strong className="font-medium text-ink">Drag the handle to compare.</strong> At your visit the dentist records your starting shade, so you can see the change for yourself.
            </p>
            <Link to={`/services/${beforeAfterCases[0].service}`} className="link mt-6 inline-block">About tooth whitening</Link>
          </div>
          <div data-reveal style={stagger(1)}>
            <BeforeAfter item={beforeAfterCases[0]} />
          </div>
        </section>
      )}

      {/* How booking works: a true sequence, so it is numbered */}
      <section id="how-booking-works" aria-labelledby="how-h" className="wrap section-y">
        <div data-reveal className="on-blue grid gap-10 rounded-panel bg-panel p-[clamp(1.5rem,4.5vw,3.5rem)] text-white lg:grid-cols-[1fr_2fr] lg:gap-14">
          <div>
            <h2 id="how-h" className="text-h2 text-white">Booking takes about a minute</h2>
            <p className="mt-5 text-white/90">No account and no payment online. You only need an Ethio Telecom number (09…) for the SMS.</p>
            <Button asChild variant="inverse" className="mt-8">
              <Link to="/book"><CalendarDays data-icon="inline-start" />{t('cta.book')}</Link>
            </Button>
          </div>
          <ol className="grid sm:grid-cols-3">
            {[
              ['Choose', 'Pick your clinic, the treatment and a dentist, or let us choose whoever is free.'],
              ['Pick a time', 'See the open times for the day you want and tap one.'],
              ['Get the SMS', 'We text you once the clinic confirms your time.'],
            ].map(([title, body], i) => (
              <li key={title} className="border-t border-white/25 py-6 sm:border-t-0 sm:border-l sm:px-6 sm:py-1 sm:first:border-l-0 sm:first:pl-0">
                <span className="font-display text-[3.5rem] leading-none font-medium tracking-[-0.04em] text-adey tabular-nums">{i + 1}</span>
                <h3 className="mt-6 text-h3 text-white">{title}</h3>
                <p className="mt-2 text-[0.9375rem] text-white/85">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Dentists */}
      <section id="dentists" aria-labelledby="team-h" className="wrap">
        <SectionHead id="team-h" title="Your dentists">
          <Link to="/doctors" className="link">Meet the team</Link>
        </SectionHead>
        <ul className="mt-[clamp(1.75rem,4vw,3rem)] grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dentists.map((d, i) => (
            <li key={d.slug} data-reveal style={stagger(i + 1)} className="grid">
              <Link to={`/doctors#${d.slug}`}
                className="group flex flex-col rounded-card bg-white p-6 ring-1 ring-line transition-[box-shadow,transform] duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgb(15_35_80/0.45)] hover:ring-roha-300">
                <DentistAvatar dentist={d} shape="tile" className="aspect-[4/5] w-full text-3xl" />
                <span className="mt-5 font-display text-xl leading-tight text-ink">{d.name}</span>
                <span className="mt-1.5 text-[0.9375rem]">{d.title}</span>
                <span className="mt-4 flex items-center gap-1.5 text-sm text-roha-600">
                  <MapPin className="size-4" aria-hidden="true" />
                  {d.locations.map((s) => locations.find((l) => l.slug === s)!.city).join(' and ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ preview */}
      <section id="faq" aria-labelledby="faq-h" className="wrap grid gap-8 pt-[clamp(4rem,9vw,7.5rem)] lg:grid-cols-[1fr_2fr] lg:gap-14">
        <div data-reveal>
          <h2 id="faq-h" className="text-h2">Before you book</h2>
          <Link to="/faq" className="link mt-5 inline-block">All questions</Link>
        </div>
        <Accordion data-reveal style={stagger(1)} type="single" collapsible className="border-t border-line">
          {faqPreview.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger>{f.q}</AccordionTrigger>
              <AccordionContent>{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <CtaBand />
    </>
  );
}
