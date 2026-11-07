import type { ReactNode } from 'react';
import { Link } from 'react-router';

export type Crumb = { name: string; path: string };

/** Inner-page header: breadcrumbs, H1, lede. */
export function PageIntro({ crumbs, title, lede, children }: { crumbs: Crumb[]; title: string; lede?: string; children?: ReactNode }) {
  return (
    <div className="border-b border-line bg-[linear-gradient(180deg,#fff,var(--color-page))]">
      <div className="wrap pt-8 pb-[clamp(3rem,7vw,5.5rem)] sm:pt-12">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-sm">
            {crumbs.map((c, i) => (
              <li key={c.path} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true" className="text-roha-300">/</span>}
                {i === crumbs.length - 1 ? (
                  <span aria-current="page">{c.name}</span>
                ) : (
                  <Link to={c.path} className="hover:text-roha-700 hover:underline">{c.name}</Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="mt-6 max-w-[16ch] text-h1">{title}</h1>
        {lede && <p className="mt-6 max-w-2xl text-lede">{lede}</p>}
        {children}
      </div>
    </div>
  );
}
