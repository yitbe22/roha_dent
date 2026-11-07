import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Clock } from 'lucide-react';
import { services } from '../content/services';
import { stagger } from '../lib/useReveal';
import { Badge } from '@/components/ui/badge';

/**
 * Every treatment as a plain card that opens its page; the last card is the
 * "not sure" route into a check-up. Used on the home page and /services.
 */
export function TreatmentGrid({ headingLevel = 'h3' }: { headingLevel?: 'h2' | 'h3' }) {
  const { t } = useTranslation();
  const H = headingLevel;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {services.map((s, i) => (
        <li key={s.slug} data-reveal style={stagger(i % 4)} className="grid">
          <Link
            to={`/services/${s.slug}`}
            className="group relative flex min-h-60 flex-col rounded-card bg-white p-6 ring-1 ring-line transition-[box-shadow,transform] duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgb(15_35_80/0.45)] hover:ring-roha-300 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <Badge variant="secondary" className="tabular-nums">
                <Clock data-icon="inline-start" />
                {t('common.minutes', { count: s.durationMinutes })}
              </Badge>
              <span className="grid size-9 place-items-center rounded-full border border-line text-roha-700 transition-colors duration-300 group-hover:border-roha-700 group-hover:bg-roha-700 group-hover:text-white" aria-hidden="true">
                <ArrowUpRight className="size-4" />
              </span>
            </div>
            <H className="mt-auto pt-10 font-display text-[1.375rem] leading-tight text-ink">{s.shortName}</H>
            <p className="mt-2 text-[0.9375rem] leading-relaxed">{s.summary}</p>
          </Link>
        </li>
      ))}
      <li data-reveal style={stagger(3)} className="grid">
        <Link
          to="/book?service=scaling"
          className="group on-blue flex min-h-60 flex-col rounded-card bg-roha-700 p-6 text-white transition-[box-shadow,transform] duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgb(15_35_80/0.7)]"
        >
          <span className="grid size-9 place-items-center self-end rounded-full bg-white text-roha-700" aria-hidden="true">
            <ArrowUpRight className="size-4" />
          </span>
          <H className="mt-auto pt-10 font-display text-[1.375rem] leading-tight text-white">Not sure what you need?</H>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-white/85">
            Book a check-up and cleaning. The dentist looks at everything and explains your options.
          </p>
        </Link>
      </li>
    </ul>
  );
}
