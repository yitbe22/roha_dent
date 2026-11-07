import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, CalendarDays, Clock, MapPin, Phone } from 'lucide-react';
import { Seo } from '../lib/seo';
import { breadcrumbLd, dentistLd } from '../lib/schema';
import { stagger } from '../lib/useReveal';
import { getLocation, locations } from '../content/locations';
import { dentists } from '../content/dentists';
import { services } from '../content/services';
import { PageIntro } from '../components/PageIntro';
import { CtaBand } from '../components/CtaBand';
import { Icon } from '../components/Icon';
import { Monogram } from '../components/Monogram';
import NotFound from './NotFound';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

  const facts = [
    { icon: MapPin, title: t('common.address'), body: [l.address, l.directions], link: { href: l.mapUrl, label: t('cta.directions') } },
    { icon: Clock, title: t('common.hours'), body: l.hoursText },
    { icon: Phone, title: t('common.phone'), body: [l.phoneDisplay], link: { href: `https://wa.me/${l.whatsapp}`, label: t('cta.whatsapp') } },
  ];

  return (
    <>
      <Seo
        title={`${l.city} Dental Clinic`}
        description={`Visit Roha Speciality Dental Center in ${l.city}. Call ${l.phoneDisplay}, get directions, see opening hours, or book an appointment online.`}
        path={`/locations/${l.slug}`}
        jsonLd={[dentistLd(l), breadcrumbLd(crumbs)]}
      />
      <PageIntro
        crumbs={crumbs}
        title={`Roha Dental in ${l.city}`}
        lede={l.intro}
        media={
          <a href={l.mapUrl} target="_blank" rel="noopener"
            className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-panel bg-roha-700 p-6 text-white lg:aspect-[5/4]">
            <svg className="absolute inset-0 size-full text-roha-600" aria-hidden="true">
              <defs>
                <pattern id={`grid-${l.slug}`} width="36" height="36" patternUnits="userSpaceOnUse">
                  <path d="M36 0H0v36" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#grid-${l.slug})`} />
            </svg>
            <span className="absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-roha-700 shadow-[0_12px_30px_-10px_rgb(0_0_0/0.45)]" aria-hidden="true">
              <MapPin className="size-6" />
            </span>
            <span className="relative flex w-full items-center justify-between gap-4 font-medium">
              Open {l.city} clinic in Google Maps
              <span className="grid size-9 place-items-center rounded-full bg-white text-roha-700" aria-hidden="true"><ArrowUpRight className="size-4" /></span>
            </span>
          </a>
        }
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild><a href={`tel:${l.phoneE164}`}><Phone data-icon="inline-start" />{t('cta.callCity', { city: l.city })}</a></Button>
          <Button asChild variant="outline"><Link to={`/book?location=${l.slug}`}><CalendarDays data-icon="inline-start" />{t('cta.book')}</Link></Button>
        </div>
      </PageIntro>

      <section aria-label="Visiting" className="wrap mt-[clamp(2.5rem,5vw,4rem)] grid gap-4 md:grid-cols-3">
        {facts.map((f, i) => (
          <Card key={f.title} data-reveal style={stagger(i)}>
            <CardHeader>
              <f.icon className="mb-3 size-6 text-roha-500" aria-hidden="true" />
              <CardTitle><h2 className="text-xl leading-tight">{f.title}</h2></CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {f.body.map((b, j) => <p key={b} className={j === 0 ? 'text-ink' : ''}>{b}</p>)}
              {f.link && (
                <a href={f.link.href} target="_blank" rel="noopener" className="link mt-3 inline-flex w-fit items-center gap-1.5">
                  {f.link.label === t('cta.whatsapp') && <Icon name="whatsapp" className="size-4" />}
                  {f.link.label}
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="team-h" className="wrap mt-[clamp(4rem,9vw,7.5rem)] grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div data-reveal>
          <h2 id="team-h" className="text-h2 max-w-[12ch]">Dentists in {l.city}</h2>
          <Link to="/doctors" className="link mt-5 inline-block">All dentists</Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {team.map((d, i) => (
            <li key={d.slug} data-reveal style={stagger(i + 1)}>
              <Link to={`/doctors#${d.slug}`} className="flex items-center gap-4 rounded-card p-4 ring-1 ring-line transition-colors hover:ring-roha-300">
                <Monogram name={d.name} className="size-14 text-lg" />
                <span className="leading-tight">
                  <span className="block font-display text-lg text-ink">{d.name}</span>
                  <span className="text-sm">{d.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="svc-h" className="wrap mt-[clamp(4rem,9vw,7.5rem)] grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <h2 id="svc-h" data-reveal className="text-h2 max-w-[12ch]">Treatments here</h2>
        <div data-reveal style={stagger(1)}>
          <ul className="flex flex-wrap gap-2">
            {services.map((s) => (
              <li key={s.slug}>
                <Badge asChild variant="outline" className="h-10 px-4 text-[0.9375rem] hover:border-roha-300">
                  <Link to={`/services/${s.slug}`}>{s.shortName}</Link>
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-8">
            Also in {other.city}: <Link to={`/locations/${other.slug}`} className="link">Roha Dental {other.city}</Link>
          </p>
        </div>
      </section>

      <CtaBand bookTo={`/book?location=${l.slug}`} />
    </>
  );
}
