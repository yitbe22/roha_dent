import { Fragment, useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { landFlight } from '../lib/photoFlight';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const idx = (i: number) => ({ '--i': i }) as CSSProperties;
/** Entrance delay in seconds (see "Page entrance" in styles.css). */
const at = (d: number) => ({ '--d': `${d}s` }) as CSSProperties;

export type Crumb = { name: string; path: string };

/** The title split into masked words, so each word can slide into place on its own. */
function Words({ text, className }: { text: string; className: string }) {
  const parts = text.split(' ');
  return parts.map((w, i) => (
    <Fragment key={i}>
      <span className="word-mask"><span className={className} style={idx(i)}>{w}</span></span>
      {i < parts.length - 1 && ' '}
    </Fragment>
  ));
}

/**
 * Inner-page header: breadcrumbs, H1, lede, actions. With `media` the header splits into
 * text + a framed photo; `compact` is for task pages (booking) where the form should start high.
 *
 * Every page opens with the Habesha entrance: the breadcrumbs and lede rise out of a soft blur,
 * the title rises word by word out of masks, and the photo wipes open from the bottom while it
 * settles from a slight zoom.
 *
 * `arrive` is the treatment-page variant (after the Habesha product page): the title slides in
 * sideways and the details rise in turn, timed against a card photo flying into the header photo,
 * which therefore holds still.
 */
export function PageIntro({ crumbs, title, lede, children, media, compact = false, arrive = false }: {
  crumbs: Crumb[]; title: string; lede?: string; children?: ReactNode; media?: ReactNode; compact?: boolean; arrive?: boolean;
}) {
  const rise = (i: number, d: number) => (arrive ? { 'data-arrive': '', style: idx(i) } : { 'data-enter': '', style: at(d) });
  return (
    <header className="bg-[linear-gradient(180deg,#fff,var(--color-page))]">
      <div className={`wrap grid items-end gap-10 pt-8 sm:pt-10 ${compact ? 'pb-10' : 'pb-[clamp(3rem,7vw,5.5rem)]'} ${media ? 'lg:grid-cols-[1.15fr_1fr] lg:gap-16' : ''}`}>
        <div>
          <Breadcrumb {...(arrive ? {} : { 'data-enter': '' })}>
            <BreadcrumbList>
              {crumbs.map((c, i) => (
                <Fragment key={c.path}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {i === crumbs.length - 1 ? (
                      <BreadcrumbPage>{c.name}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild><Link to={c.path}>{c.name}</Link></BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className={`mt-6 ${compact ? 'text-h2' : 'max-w-[16ch] text-h1'}`}>
            <Words text={title} className={arrive ? 'arrive-word' : 'enter-word'} />
          </h1>
          {lede && (
            <p {...rise(1, 0.25)} className={`max-w-[38rem] ${compact ? 'mt-3' : 'mt-6 text-lede'}`}>{lede}</p>
          )}
          {children && <div {...rise(2, 0.35)}>{children}</div>}
        </div>
        {media && (arrive ? (
          <div>{media}</div>
        ) : (
          <div className="enter-image rounded-panel" style={at(0.15)}>
            <div className="enter-zoom">{media}</div>
          </div>
        ))}
      </div>
    </header>
  );
}

/** A framed photo for PageIntro's media slot. With `flight`, a card photo flying in (lib/photoFlight) lands on it. */
export function IntroPhoto({ src, alt, width, height, flight }: {
  src: string; alt: string; width: number; height: number; flight?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  useIsoLayoutEffect(() => {
    if (flight) landFlight(flight, ref.current);
  }, [flight]);
  return (
    <img ref={ref} src={src} alt={alt} width={width} height={height} fetchPriority="high"
      className="aspect-[4/3] w-full rounded-panel object-cover lg:aspect-[5/4]" />
  );
}
