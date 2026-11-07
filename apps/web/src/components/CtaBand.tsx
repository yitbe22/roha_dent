import { useRef } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Phone } from 'lucide-react';
import { locations } from '../content/locations';
import { useGlideIn } from '../lib/scrollFx';
import { Button } from '@/components/ui/button';

/**
 * Closing band: book online, or call either clinic. A 3D clear aligner and a glass tooth
 * (pre-rendered by scripts/render-deco.mjs) glide in from the sides as it scrolls into view.
 */
export function CtaBand({ title = 'Ready when you are', body, bookTo = '/book' }: { title?: string; body?: string; bookTo?: string }) {
  const { t } = useTranslation();
  const section = useRef<HTMLElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  useGlideIn(section, left, right);
  return (
    <section ref={section} id="book" aria-label="Book an appointment" className="wrap relative mt-[clamp(2.5rem,6vw,4.5rem)] overflow-x-clip py-[clamp(2.5rem,6vw,4.5rem)]">
      <div ref={left} aria-hidden="true"
        className="pointer-events-none absolute top-0 -left-[2%] z-10 w-[clamp(7.5rem,18vw,16rem)] will-change-[transform,opacity,filter] max-sm:opacity-60">
        <span className="absolute inset-[10%] -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(61_138_247/0.18),transparent)]" />
        <img src="/img/deco-aligner.webp" alt="" width={619} height={318} loading="lazy" decoding="async" className="deco-bob w-full" />
      </div>
      <div ref={right} aria-hidden="true"
        className="pointer-events-none absolute -top-[clamp(2rem,5vw,4.5rem)] right-[3%] z-10 w-[clamp(4.5rem,9vw,8rem)] will-change-[transform,opacity,filter] max-sm:opacity-60">
        <span className="absolute inset-[10%] -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(61_138_247/0.18),transparent)]" />
        <img src="/img/deco-tooth.webp" alt="" width={414} height={609} loading="lazy" decoding="async" className="deco-bob deco-bob-late w-full" />
      </div>
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
