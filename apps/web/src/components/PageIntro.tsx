import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { stagger } from '../lib/useReveal';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export type Crumb = { name: string; path: string };

/**
 * Inner-page header: breadcrumbs, H1, lede, actions. With `media` the header splits into
 * text + a framed photo; `compact` is for task pages (booking) where the form should start high.
 */
export function PageIntro({ crumbs, title, lede, children, media, compact = false }: {
  crumbs: Crumb[]; title: string; lede?: string; children?: ReactNode; media?: ReactNode; compact?: boolean;
}) {
  return (
    <header className="bg-[linear-gradient(180deg,#fff,var(--color-page))]">
      <div className={`wrap grid items-end gap-10 pt-8 sm:pt-10 ${compact ? 'pb-10' : 'pb-[clamp(3rem,7vw,5.5rem)]'} ${media ? 'lg:grid-cols-[1.15fr_1fr] lg:gap-16' : ''}`}>
        <div>
          <Breadcrumb>
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
          <h1 data-reveal className={`mt-6 ${compact ? 'text-h2' : 'max-w-[16ch] text-h1'}`}>{title}</h1>
          {lede && (
            <p data-reveal style={stagger(1)} className={`max-w-[38rem] ${compact ? 'mt-3' : 'mt-6 text-lede'}`}>{lede}</p>
          )}
          {children && <div data-reveal style={stagger(2)}>{children}</div>}
        </div>
        {media && <div data-reveal style={stagger(2)}>{media}</div>}
      </div>
    </header>
  );
}

/** A framed photo for PageIntro's media slot. */
export function IntroPhoto({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return (
    <img src={src} alt={alt} width={width} height={height} fetchPriority="high"
      className="aspect-[4/3] w-full rounded-panel object-cover lg:aspect-[5/4]" />
  );
}
