import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Seo } from '../lib/seo';
import { organizationLd, dentistLd } from '../lib/schema';
import { locations } from '../content/locations';
import { services } from '../content/services';
import { dentists } from '../content/dentists';
import { faqGroups } from '../content/faq';
import { LocationPanel } from '../components/LocationPanel';
import { Icon } from '../components/Icon';

function SectionHead({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <h2 id={id} className="text-h2 max-w-[18ch]">{title}</h2>
      {children}
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const faqPreview = faqGroups[0].items.slice(0, 3);
  const facts = [
    { value: String(locations.length), label: 'Clinics, in Addis Ababa and Gonder' },
    { value: String(services.length), label: 'Treatments, from cleaning to crowns' },
    { value: 'Mon–Sat', label: 'Open 8:30 – 17:30 at both clinics' },
    { value: 'SMS', label: 'Your booking is confirmed by text' },
  ];

  return (
    <>
      <Seo
        title="Roha Speciality Dental Center | Dentist in Addis Ababa & Gonder"
        description="Teeth cleaning, whitening, clear aligners, root canal treatment, crowns and dentures in Addis Ababa and Gonder. Book online in a minute or call the clinic."
        path="/"
        jsonLd={[organizationLd(), ...locations.map(dentistLd)]}
      />

      {/* Hero */}
      <section className="overflow-hidden">
        <div className="wrap grid items-center gap-10 pt-8 pb-[clamp(3rem,7vw,6rem)] lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-14">
          <div>
            <h1 className="text-h1 max-w-[13ch]">Specialist dental care in Addis Ababa and Gonder</h1>
            <p className="mt-7 max-w-[34rem] text-lede">
              From routine cleaning to root canals, crowns and clear aligners. Pick a time online and we confirm it by SMS. You pay at the clinic.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/book" className="btn-primary pl-2">
                <span className="btn-ic"><Icon name="calendar" className="size-4" /></span>
                {t('cta.book')}
              </Link>
              <Link to="/services" className="btn-ghost">See treatments</Link>
            </div>
            <ul className="mt-9 flex flex-wrap gap-2" aria-label="Clinics">
              {locations.map((l) => (
                <li key={l.slug}>
                  <Link to={`/locations/${l.slug}`} className="chip block hover:border-sky">{l.city}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative isolate">
            <div className="absolute inset-[8%] -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(61_138_247/0.22),transparent)] blur-xl" aria-hidden="true" />
            <img
              src="/img/clinic-room.webp"
              alt="A Roha treatment room with a blue and white dental chair"
              width={667}
              height={889}
              fetchPriority="high"
              className="aspect-[4/3] w-full rounded-panel object-cover sm:aspect-[5/4] lg:ml-auto lg:aspect-[4/5] lg:max-w-[30rem]"
            />
          </div>
        </div>
      </section>

      {/* About: the clinic itself */}
      <section aria-labelledby="about-h" className="wrap">
        <div className="on-blue relative isolate flex min-h-[34rem] flex-col justify-between gap-12 overflow-hidden rounded-panel p-[clamp(1.5rem,4vw,2.75rem)] text-white">
          <img src="/img/clinic-hallway.webp" alt="" width={1284} height={856} loading="lazy"
            className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(29_62_130/0.9)_0%,rgb(42_82_158/0.66)_50%,rgb(25_55_120/0.9)_100%)]" aria-hidden="true" />
          <div className="max-w-2xl">
            <h2 id="about-h" className="text-h2 max-w-[15ch] text-white">Two clinics, one way of caring for you</h2>
            <p className="mt-5 max-w-[46ch] text-white/90">
              Roha Speciality Dental Center cares for families in Addis Ababa and Gonder. Every visit starts with an examination, so your dentist can explain what is needed, your options and what to expect before treatment begins.
            </p>
            <Link to="/about" className="btn-ghost-blue mt-7">About Roha</Link>
          </div>
          <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col-reverse justify-end rounded-card border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:p-5">
                <dt className="mt-2 text-sm text-white/90">{f.label}</dt>
                <dd className="font-display text-[clamp(1.625rem,4vw,3.25rem)] leading-none whitespace-nowrap font-medium tracking-[-0.03em] tabular-nums">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Clinics */}
      <section aria-labelledby="clinics-h" className="wrap section-y">
        <SectionHead id="clinics-h" title="Choose your clinic" />
        <p className="mt-4 max-w-2xl">
          Both clinics are open Monday to Saturday. Call, message us on WhatsApp, or book a time online.
        </p>
        <div className="mt-[clamp(1.75rem,4vw,3rem)] grid gap-4 md:grid-cols-2">
          {locations.map((l) => <LocationPanel key={l.slug} location={l} />)}
        </div>
      </section>

      {/* Services: a list, not cards (name, what it is, how long it takes) */}
      <section aria-labelledby="services-h" className="section-y bg-page">
        <div className="wrap">
          <SectionHead id="services-h" title="Treatments">
            <Link to="/services" className="link">{t('cta.allServices')}</Link>
          </SectionHead>
          <ul className="mt-[clamp(1.75rem,4vw,3rem)] grid border-t border-line md:grid-cols-2 md:gap-x-14">
            {services.map((s) => (
              <li key={s.slug} className="border-b border-line">
                <Link to={`/services/${s.slug}`} className="group flex items-start justify-between gap-6 py-6">
                  <span>
                    <span className="block font-display text-xl font-medium tracking-[-0.012em] text-ink decoration-sky decoration-[1.5px] underline-offset-4 group-hover:underline">
                      {s.name}
                    </span>
                    <span className="mt-1.5 block">{s.summary}</span>
                  </span>
                  <span className="mt-1 shrink-0 rounded-full bg-white px-2.5 py-1 text-sm text-roha-700 tabular-nums ring-1 ring-line">
                    {t('common.minutes', { count: s.durationMinutes })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How booking works: a true sequence, so it is numbered */}
      <section aria-labelledby="how-h" className="wrap section-y">
        <div className="on-blue grid gap-10 rounded-panel bg-panel p-[clamp(1.5rem,4.5vw,3.5rem)] text-white lg:grid-cols-[1fr_2fr] lg:gap-14">
          <div>
            <h2 id="how-h" className="text-h2 text-white">Booking takes about a minute</h2>
            <p className="mt-5 text-white/90">No account and no payment online. You only need an Ethio Telecom number (09…) for the SMS.</p>
            <Link to="/book" className="btn-light mt-8 pl-2">
              <span className="btn-ic bg-roha-100"><Icon name="calendar" className="size-4" /></span>
              {t('cta.book')}
            </Link>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ['Choose', 'Pick your clinic, the treatment and a dentist, or let us choose whoever is free.'],
              ['Pick a time', 'See the open times for the day you want and tap one.'],
              ['Get the SMS', 'We text you when we receive the request and again when it is confirmed.'],
            ].map(([title, body], i) => (
              <li key={title} className="rounded-card bg-white/10 p-5 ring-1 ring-white/15">
                <span className="grid size-9 place-items-center rounded-full bg-white font-display font-medium text-roha-700 tabular-nums">{i + 1}</span>
                <h3 className="mt-5 text-h3 text-white">{title}</h3>
                <p className="mt-2 text-[0.9375rem] text-white/90">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Dentists */}
      <section aria-labelledby="team-h" className="wrap">
        <SectionHead id="team-h" title="Your dentists">
          <Link to="/doctors" className="link">Meet the team</Link>
        </SectionHead>
        <ul className="mt-[clamp(1.75rem,4vw,3rem)] grid grid-cols-2 gap-3 lg:grid-cols-4">
          {dentists.map((d) => (
            <li key={d.slug} className="flex flex-col gap-3 rounded-card bg-panel p-2 pb-4 text-white">
              <div className="grid aspect-[4/5] place-items-center rounded-inner bg-gradient-to-br from-[#eaf2ff] to-[#c9dcff] font-display text-[clamp(2.5rem,6vw,4rem)] font-medium tracking-[-0.05em] text-roha-700" aria-hidden="true">
                {d.name.replace('Dr. ', '').split(' ').map((p) => p[0]).join('')}
              </div>
              <div className="px-1.5">
                <p className="font-display text-lg leading-tight font-medium">{d.name}</p>
                <p className="mt-1 text-sm text-white/90">{d.title}</p>
                <p className="mt-1 text-sm text-white/85">
                  {d.locations.map((s) => locations.find((l) => l.slug === s)!.city).join(' and ')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ preview */}
      <section aria-labelledby="faq-h" className="wrap grid gap-8 pt-[clamp(4rem,9vw,7.5rem)] lg:grid-cols-[1fr_2fr] lg:gap-14">
        <div>
          <h2 id="faq-h" className="text-h2">Before you book</h2>
          <Link to="/faq" className="link mt-5 inline-block">All questions</Link>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {faqPreview.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-medium text-ink">
                {f.q}
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-roha-700 transition-colors group-open:border-sky group-open:bg-[#f2f7ff]">
                  <Icon name="plus" className="size-4 transition-transform duration-300 group-open:rotate-45" />
                </span>
              </summary>
              <p className="mt-3 max-w-prose">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
