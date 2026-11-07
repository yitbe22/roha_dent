import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Phone } from 'lucide-react';
import { locations } from '../content/locations';
import { Button } from '@/components/ui/button';

/** Closing band for inner pages: book online, or call either clinic. */
export function CtaBand({ title = 'Ready when you are', body, bookTo = '/book' }: { title?: string; body?: string; bookTo?: string }) {
  const { t } = useTranslation();
  return (
    <section aria-label="Book an appointment" className="wrap mt-[clamp(4rem,9vw,7.5rem)]">
      <div data-reveal className="on-blue relative isolate overflow-hidden rounded-panel bg-roha-700 px-[clamp(1.5rem,5vw,4rem)] py-[clamp(2.5rem,6vw,4.5rem)] text-white">
        <img src="/img/logo-white.png" alt="" width={282} height={320} aria-hidden="true"
          className="pointer-events-none absolute -right-8 -bottom-16 -z-10 w-60 opacity-[0.07] sm:w-80" />
        <div className="grid items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h2 className="before:mb-5 before:block before:h-0.5 before:w-7 before:rounded-full before:bg-adey before:content-[''] text-h2 max-w-[16ch] text-white">{title}</h2>
            <p className="mt-4 max-w-[44ch] text-white/85">
              {body ?? 'Pick a time online in about a minute, and we confirm it by SMS. Prefer to talk? Call either clinic.'}
            </p>
          </div>
          <div className="grid w-full max-w-md gap-3 sm:grid-cols-2 lg:ml-auto">
            <Button asChild variant="inverse" size="lg" className="sm:col-span-2">
              <Link to={bookTo}><CalendarDays data-icon="inline-start" />{t('cta.book')}</Link>
            </Button>
            {locations.map((l) => (
              <Button key={l.slug} asChild variant="inverse-outline">
                <a href={`tel:${l.phoneE164}`}><Phone data-icon="inline-start" />{t('cta.callCity', { city: l.city })}</a>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
