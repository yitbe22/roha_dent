import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Languages, MapPin } from 'lucide-react';
import { Seo } from '../lib/seo';
import { breadcrumbLd } from '../lib/schema';
import { stagger } from '../lib/useReveal';
import { dentists } from '../content/dentists';
import { locations } from '../content/locations';
import { getService } from '../content/services';
import { PageIntro } from '../components/PageIntro';
import { CtaBand } from '../components/CtaBand';
import { DentistAvatar } from '../components/DentistAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

export default function Doctors() {
  const { t } = useTranslation();
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Dentists', path: '/doctors' }];
  return (
    <>
      <Seo
        title="Our Dentists"
        description="Meet the dentists at Roha Speciality Dental Center in Addis Ababa and Gonder: general and cosmetic dentistry, root canal treatment, crowns and orthodontics."
        path="/doctors"
        jsonLd={[breadcrumbLd(crumbs)]}
      />
      <PageIntro
        crumbs={crumbs}
        title="Our dentists"
        lede="When you book, you can choose a dentist or take the first free time with anyone who offers the treatment."
      />
      <ul className="wrap mt-[clamp(2.5rem,5vw,4rem)] grid gap-4 md:grid-cols-2">
        {dentists.map((d, i) => (
          <li key={d.slug} id={d.slug} data-reveal style={stagger(i % 2)} className="grid scroll-mt-24">
            <Card>
              <CardContent className="grid gap-6 sm:grid-cols-[8.5rem_1fr]">
                <DentistAvatar dentist={d} shape="tile" className="aspect-[4/5] w-28 text-4xl sm:w-full" />
                <div className="min-w-0">
                  <h2 className="font-display text-[1.625rem] leading-tight">{d.name}</h2>
                  <p className="mt-1 font-medium text-roha-600">{d.title}</p>
                  <p className="mt-4">{d.bio}</p>
                  <ul className="mt-5 flex flex-wrap gap-1.5" aria-label={t('common.treatments')}>
                    {d.services.map((s) => (
                      <li key={s}><Badge variant="secondary">{getService(s)?.shortName}</Badge></li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="mt-auto flex-wrap justify-between gap-4">
                <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <div className="flex items-center gap-1.5">
                    <dt><MapPin className="size-4 text-roha-500" aria-label={t('common.worksAt')} /></dt>
                    <dd>{d.locations.map((s) => locations.find((l) => l.slug === s)!.city).join(', ')}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt><Languages className="size-4 text-roha-500" aria-label={t('common.languages')} /></dt>
                    <dd>{d.languages.join(', ')}</dd>
                  </div>
                </dl>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/book?dentist=${d.slug}`}><CalendarDays data-icon="inline-start" />Book with {d.name.split(' ')[1]}</Link>
                </Button>
              </CardFooter>
            </Card>
          </li>
        ))}
      </ul>
      <CtaBand title="No preference?" body="Book with the first available dentist. You see more free times, and every dentist explains your options before treatment." />
    </>
  );
}
