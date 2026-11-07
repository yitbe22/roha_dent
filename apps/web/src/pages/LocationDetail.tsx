import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Seo } from '../lib/seo';
import { breadcrumbLd, dentistLd } from '../lib/schema';
import { getLocation, locations } from '../content/locations';
import { dentists } from '../content/dentists';
import { services } from '../content/services';
import { PageIntro } from '../components/PageIntro';
import { Icon } from '../components/Icon';
import NotFound from './NotFound';

export default function LocationDetail() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const l = getLocation(slug);
  if (!l) return <NotFound />;

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Locations', path: '/contact' },
    { name: l.city, path: `/locations/${l.slug}` },
  ];
  const team = dentists.filter((d) => d.locations.includes(l.slug));
  const other = locations.find((x) => x.slug !== l.slug)!;

  return (
    <>
      <Seo
        title={`${l.city} Dental Clinic`}
        description={`Visit Roha Speciality Dental Center in ${l.city}. Call ${l.phoneDisplay}, get directions, see opening hours, or book an appointment online.`}
        path={`/locations/${l.slug}`}
        jsonLd={[dentistLd(l), breadcrumbLd(crumbs)]}
      />
      <PageIntro crumbs={crumbs} title={`Roha Dental in ${l.city}`} lede={l.intro}>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={`tel:${l.phoneE164}`} className="btn-primary px-6"><Icon name="phone" />{t('cta.callCity', { city: l.city })}</a>
          <Link to={`/book?location=${l.slug}`} className="btn-ghost px-6"><Icon name="calendar" />{t('cta.book')}</Link>
        </div>
      </PageIntro>

      <div className="wrap mt-14 grid gap-12 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="visit-h" className="space-y-8">
          <h2 id="visit-h" className="text-h2">Visiting</h2>
          <dl className="space-y-6">
            <div>
              <dt className="font-bold text-roha-900">{t('common.address')}</dt>
              <dd className="mt-1">{l.address}</dd>
              <dd className="mt-1 text-ink-soft">{l.directions}</dd>
              <dd className="mt-2"><a href={l.mapUrl} target="_blank" rel="noopener" className="link">{t('cta.directions')}</a></dd>
            </div>
            <div>
              <dt className="font-bold text-roha-900">{t('common.hours')}</dt>
              {l.hoursText.map((h) => <dd key={h} className="mt-1">{h}</dd>)}
            </div>
            <div>
              <dt className="font-bold text-roha-900">{t('common.phone')}</dt>
              <dd className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
                <a href={`tel:${l.phoneE164}`} className="link">{l.phoneDisplay}</a>
                <a href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noopener" className="link">{t('cta.whatsapp')}</a>
              </dd>
            </div>
          </dl>
          <a
            href={l.mapUrl}
            target="_blank"
            rel="noopener"
            className="rounded-card group relative flex aspect-[16/9] items-end overflow-hidden bg-roha-700 p-6 text-white"
          >
            <svg className="absolute inset-0 h-full w-full text-roha-600" aria-hidden="true">
              <defs>
                <pattern id={`grid-${l.slug}`} width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M32 0H0v32" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#grid-${l.slug})`} />
            </svg>
            <span className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-roha-700 shadow-lg" aria-hidden="true"><Icon name="pin" className="size-5" /></span>
            <span className="relative font-semibold group-hover:underline">Open {l.city} clinic in Google Maps</span>
          </a>
        </section>

        <section aria-labelledby="team-h">
          <h2 id="team-h" className="text-h2">Dentists in {l.city}</h2>
          <ul className="mt-6 space-y-5">
            {team.map((d) => (
              <li key={d.slug} className="border-b border-line pb-5">
                <p className="text-lg font-bold text-roha-900">{d.name}</p>
                <p className="text-ink-soft">{d.title}</p>
              </li>
            ))}
          </ul>
          <h2 className="mt-12 text-h3">Treatments offered</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <li key={s.slug}><Link to={`/services/${s.slug}`} className="link">{s.shortName}</Link></li>
            ))}
          </ul>
          <p className="mt-12 text-ink-soft">
            Also in {other.city}: <Link to={`/locations/${other.slug}`} className="link">Roha Dental {other.city}</Link>
          </p>
        </section>
      </div>
    </>
  );
}
