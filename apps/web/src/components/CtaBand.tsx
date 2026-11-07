import { useRef } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Phone } from 'lucide-react';
import { locations } from '../content/locations';
import { useGlideIn } from '../lib/scrollFx';
import { stagger } from '../lib/useReveal';

/**
 * Closing band, laid out like the reference's "Book your first step": a white, centred section
 * with a small 3D clear aligner at the left edge of the screen and a glass tooth lower on the
 * right (pre-rendered by scripts/render-deco.mjs). Both glide in from the sides as it scrolls into view.
 */
export function CtaBand({ title = 'Book your first step', body, bookTo = '/book' }: { title?: string; body?: string; bookTo?: string }) {
  const { t } = useTranslation();
  const section = useRef<HTMLElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  useGlideIn(section, left, right);
  const glow = 'absolute -inset-[35%] -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(61_138_247/0.16),transparent)]';
  return (
    <section ref={section} id="book" aria-labelledby="book-h"
      className="relative isolate overflow-x-clip py-[clamp(5rem,10vw,8.75rem)]">
      <div ref={left} aria-hidden="true"
        className="pointer-events-none absolute top-[12%] -left-[1.5%] z-10 w-[clamp(5rem,10.5vw,10rem)] will-change-[transform,opacity,filter] max-sm:top-[3%] max-sm:opacity-55">
        <span className={glow} />
        <img src="/img/deco-aligner.webp" alt="" width={619} height={318} loading="lazy" decoding="async" className="deco-bob w-full" />
      </div>
      <div ref={right} aria-hidden="true"
        className="pointer-events-none absolute top-[50%] right-[3.5%] z-10 w-[clamp(3.5rem,7.5vw,7.25rem)] will-change-[transform,opacity,filter] max-sm:top-auto max-sm:bottom-[3%] max-sm:opacity-55">
        <span className={glow} />
        <img src="/img/deco-tooth.webp" alt="" width={414} height={609} loading="lazy" decoding="async" className="deco-bob deco-bob-late w-full" />
      </div>

      <div className="wrap relative z-20 flex flex-col items-center text-center">
        <span data-reveal className="text-xs font-medium tracking-[0.14em] text-roha-700 uppercase">Book online</span>
        <h2 id="book-h" data-reveal style={stagger(1)} className="mt-3.5 text-h2 max-w-[18ch]">{title}</h2>
        <p data-reveal style={stagger(2)} className="mt-3.5 max-w-[46ch]">
          {body ?? 'Pick a clinic, a treatment and a time online in about a minute. The clinic confirms your visit by SMS.'}
        </p>
        <div data-reveal style={stagger(3)} className="mt-[clamp(1.75rem,4vw,2.75rem)] flex flex-wrap items-center justify-center gap-3">
          <Link to={bookTo} className="btn-primary min-h-11 pl-2 text-[0.9375rem]">
            <span className="btn-ic"><CalendarDays className="size-4" aria-hidden="true" /></span>
            {t('cta.book')}
          </Link>
          {locations.map((l) => (
            <a key={l.slug} href={`tel:${l.phoneE164}`} className="btn-ghost min-h-11 text-[0.9375rem]">
              <Phone className="size-4" aria-hidden="true" />{t('cta.callCity', { city: l.city })}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
