import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Clock, MapPin, Phone } from 'lucide-react';
import type { Location } from '../content/locations';
import { Icon } from './Icon';
import { srcSet } from '../lib/img';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

/** One clinic, every way to reach it. */
export function LocationPanel({ location: l, headingLevel = 'h3' }: { location: Location; headingLevel?: 'h2' | 'h3' }) {
  const { t } = useTranslation();
  const H = headingLevel;
  return (
    <Card className="h-full overflow-hidden pt-0">
      <Link to={`/locations/${l.slug}`} tabIndex={-1} aria-hidden="true" className="block overflow-hidden">
        <img src={l.photo} srcSet={srcSet(l.photo, 1600)} sizes="(min-width: 768px) 50vw, 100vw" alt="" width={1600} height={1000} loading="lazy" decoding="async"
          className="aspect-[16/9] w-full object-cover transition-transform duration-700 ease-out-soft hover:scale-[1.03]" />
      </Link>
      <CardHeader>
        <CardTitle>
          <H className="text-[1.625rem] leading-tight">{l.city}</H>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        <dl className="grid gap-3">
          <div className="flex gap-3">
            <dt className="sr-only">{t('common.hours')}</dt>
            <Clock className="mt-0.5 size-5 shrink-0 text-roha-500" aria-hidden="true" />
            <dd>{l.hoursText.map((h) => <span key={h} className="block">{h}</span>)}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="sr-only">{t('common.address')}</dt>
            <MapPin className="mt-0.5 size-5 shrink-0 text-roha-500" aria-hidden="true" />
            <dd>{l.address}</dd>
          </div>
        </dl>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button asChild className="col-span-2">
            <a href={`tel:${l.phoneE164}`}><Phone data-icon="inline-start" />{l.phoneDisplay}</a>
          </Button>
          <Button asChild variant="outline">
            <a href={`https://wa.me/${l.whatsapp}`} rel="noopener" target="_blank"><Icon name="whatsapp" className="size-4" />{t('cta.whatsapp')}</a>
          </Button>
          <Button asChild variant="outline">
            <a href={l.mapUrl} rel="noopener" target="_blank"><MapPin data-icon="inline-start" />{t('cta.directions')}</a>
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex-wrap gap-x-6 gap-y-2">
        <Link to={`/book?location=${l.slug}`} className="link">{t('cta.book')}</Link>
        <Link to={`/locations/${l.slug}`} className="link">{t('cta.viewClinic')}</Link>
      </CardFooter>
    </Card>
  );
}
