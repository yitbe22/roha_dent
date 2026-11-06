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

function HeroMark() {
  // Stepped cross (Bete Giyorgis plan) as a window; inside, a single tooth drawn in Adey yellow.
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem]" aria-hidden="true">
      <div className="step-cross absolute inset-0 bg-roha-700" />
      <div className="step-cross absolute inset-[12%] bg-roha-600/40" />
      <svg viewBox="0 0 120 120" className="absolute inset-[22%] text-adey" fill="none" stroke="currentColor"
        strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 30c-9-7-27-9-33 4-5 11-1 24 4 35 4 9 4 20 7 28 2 6 8 6 10 0 3-9 4-21 12-21s9 12 12 21c2 6 8 6 10 0 3-8 3-19 7-28 5-11 9-24 4-35-6-13-24-11-33-4z" />
        <path d="M44 41c5-3 11-3 16 0" opacity=".55" />
      </svg>
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const faqPreview = faqGroups[0].items.slice(0, 3);

  return (
    <>
      <Seo
        title="Roha Speciality Dental Center | Dentist in Addis Ababa & Gonder"
        description="Teeth cleaning, whitening, clear aligners, root canal treatment, crowns and dentures in Addis Ababa and Gonder. Book online in a minute or call the clinic."
        path="/"
        jsonLd={[organizationLd(), ...locations.map(dentistLd)]}
      />

      {/* Hero: the first decision a patient makes is which clinic */}
      <section className="overflow-hidden">
        <div className="wrap grid items-center gap-12 pt-10 pb-16 lg:grid-cols-[1.15fr_1fr] lg:pt-16 lg:pb-24">
          <div>
            <h1 className="text-h1 max-w-[14ch]">Specialist dental care in Addis Ababa and Gonder</h1>
            <p className="mt-6 max-w-xl text-lede text-ink-soft">
              From routine cleaning to root canals, crowns and clear aligners. Pick a time online and we confirm it by SMS. You pay at the clinic.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/book" className="btn-primary px-6 text-lg">
                <Icon name="calendar" />
                {t('cta.book')}
              </Link>
              <Link to="/services" className="btn-ghost px-6 text-lg">See treatments</Link>
            </div>
          </div>
          <div className="hidden sm:block">
            <HeroMark />
          </div>
        </div>
      </section>

      {/* Clinics */}
      <section aria-labelledby="clinics-h" className="wrap">
        <h2 id="clinics-h" className="text-h2">Choose your clinic</h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Both clinics are open Monday to Saturday. Call, message us on WhatsApp, or book a time online.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {locations.map((l) => <LocationPanel key={l.slug} location={l} />)}
        </div>
      </section>

      {/* Services — a list, not cards: name, what it is, how long it takes */}
      <section aria-labelledby="services-h" className="wrap mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="services-h" className="text-h2">Treatments</h2>
          <Link to="/services" className="link">{t('cta.allServices')}</Link>
        </div>
        <ul className="mt-8 grid border-t border-line md:grid-cols-2 md:gap-x-12">
          {services.map((s) => (
            <li key={s.slug} className="border-b border-line">
              <Link to={`/services/${s.slug}`} className="group flex items-start justify-between gap-6 py-5">
                <span>
                  <span className="block text-lg font-bold text-roha-900 group-hover:text-roha-700 group-hover:underline group-hover:decoration-adey group-hover:decoration-2 group-hover:underline-offset-4">
                    {s.name}
                  </span>
                  <span className="mt-1 block text-ink-soft">{s.summary}</span>
                </span>
                <span className="mt-1 shrink-0 text-sm font-semibold text-roha-600">{t('common.minutes', { count: s.durationMinutes })}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* How booking works — a true sequence, so it is numbered */}
      <section aria-labelledby="how-h" className="mt-24 bg-roha-700 text-roha-100 on-blue">
        <div className="wrap grid gap-10 py-16 lg:grid-cols-[1fr_2fr] lg:py-20">
          <div>
            <h2 id="how-h" className="text-h2 text-white">Booking takes about a minute</h2>
            <p className="mt-4 text-roha-200">No account and no payment online. You only need an Ethio Telecom number (09…) for the SMS.</p>
            <Link to="/book" className="btn-adey mt-8">{t('cta.book')}</Link>
          </div>
          <ol className="grid gap-8 sm:grid-cols-3">
            {[
              ['Choose', 'Pick your clinic, the treatment and a dentist, or let us choose whoever is free.'],
              ['Pick a time', 'See the open times for the day you want and tap one.'],
              ['Get the SMS', 'We text you when we receive the request and again when it is confirmed, with a link to change it.'],
            ].map(([title, body], i) => (
              <li key={title}>
                <span className="step-cross flex size-11 items-center justify-center bg-adey text-lg font-extrabold text-roha-900">{i + 1}</span>
                <h3 className="mt-4 text-h3 text-white">{title}</h3>
                <p className="mt-2 text-roha-200">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Dentists */}
      <section aria-labelledby="team-h" className="wrap mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="team-h" className="text-h2">Your dentists</h2>
          <Link to="/doctors" className="link">Meet the team</Link>
        </div>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {dentists.map((d) => (
            <li key={d.slug}>
              <div className="flex size-16 items-center justify-center rounded-full bg-mist text-xl font-bold text-roha-700" aria-hidden="true">
                {d.name.replace('Dr. ', '').split(' ').map((p) => p[0]).join('')}
              </div>
              <p className="mt-4 text-lg font-bold text-roha-900">{d.name}</p>
              <p className="text-ink-soft">{d.title}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {d.locations.map((s) => locations.find((l) => l.slug === s)!.city).join(' and ')}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ preview */}
      <section aria-labelledby="faq-h" className="wrap mt-24 grid gap-8 lg:grid-cols-[1fr_2fr]">
        <div>
          <h2 id="faq-h" className="text-h2">Before you book</h2>
          <Link to="/faq" className="link mt-4 inline-block">All questions</Link>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {faqPreview.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-roha-900">
                {f.q}
                <Icon name="plus" className="size-5 shrink-0 text-roha-500 transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 max-w-prose text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

    </>
  );
}
