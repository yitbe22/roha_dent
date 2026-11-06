import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Location } from '../content/locations';
import { Icon } from './Icon';

/** One clinic, every way to reach it. */
export function LocationPanel({ location: l, headingLevel = 'h3' }: { location: Location; headingLevel?: 'h2' | 'h3' }) {
  const { t } = useTranslation();
  const H = headingLevel;
  return (
    <article className="step-corner flex flex-col bg-white p-6 shadow-[0_1px_0_var(--color-line)] ring-1 ring-line sm:p-7">
      <H className="text-h3">{l.city}</H>
      <dl className="mt-4 space-y-3 text-ink-soft">
        <div className="flex gap-3">
          <dt className="sr-only">{t('common.hours')}</dt>
          <Icon name="clock" className="mt-0.5 size-5 shrink-0 text-roha-500" />
          <dd>{l.hoursText.map((h) => <span key={h} className="block">{h}</span>)}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="sr-only">{t('common.address')}</dt>
          <Icon name="pin" className="mt-0.5 size-5 shrink-0 text-roha-500" />
          <dd>{l.address}</dd>
        </div>
      </dl>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <a href={`tel:${l.phoneE164}`} className="btn-primary col-span-2">
          <Icon name="phone" />
          {l.phoneDisplay}
        </a>
        <a href={`https://wa.me/${l.whatsapp}`} className="btn-ghost" rel="noopener" target="_blank">
          <Icon name="whatsapp" />
          {t('cta.whatsapp')}
        </a>
        <a href={l.mapUrl} className="btn-ghost" rel="noopener" target="_blank">
          <Icon name="pin" />
          {t('cta.directions')}
        </a>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4">
        <Link to={`/book?location=${l.slug}`} className="link">{t('cta.book')}</Link>
        <Link to={`/locations/${l.slug}`} className="link">{t('cta.viewClinic')}</Link>
      </div>
    </article>
  );
}
