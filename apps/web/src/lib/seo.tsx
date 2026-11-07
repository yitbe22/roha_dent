import { createContext, useContext, useEffect } from 'react';
import { SITE, absoluteUrl } from '../content/site';

export type HeadData = {
  title: string;
  description?: string;
  path: string;
  /** Share image (path under public/). Defaults to SITE.ogImage. */
  ogImage?: string;
  ogImageAlt?: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
  jsonLd?: Record<string, unknown>[];
};

/** During prerender, pages report their head tags here. In the browser it is null. */
export const HeadCollector = createContext<{ set: (h: HeadData) => void } | null>(null);

/** "Page | Roha Dental" — Google shows about 60 characters, so the suffix is the short brand. */
export const fullTitle = (t: string) => (t.includes(SITE.shortName) || t.includes(SITE.name) ? t : `${t} | ${SITE.shortName}`);

/** Search snippets are cut at about 160 characters: trim on a word boundary instead. */
export const clampDescription = (d: string, max = 160) => {
  if (d.length <= max) return d;
  const cut = d.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '')}…`;
};

type Tag = { kind: 'meta'; attr: 'name' | 'property'; key: string; value: string } | { kind: 'title'; value: string };

/** Every head tag for a page, shared by the prerenderer and the in-app updater so they never drift. */
function headTags(h: HeadData): Tag[] {
  const title = fullTitle(h.title);
  const desc = clampDescription(h.description ?? SITE.defaultDescription);
  const url = absoluteUrl(h.path);
  const img = h.ogImage ?? SITE.ogImage;
  const imgAlt = h.ogImageAlt ?? (img === SITE.ogImage ? SITE.ogImageAlt : title);
  const m = (attr: 'name' | 'property', key: string, value: string): Tag => ({ kind: 'meta', attr, key, value });
  return [
    { kind: 'title', value: title },
    m('name', 'description', desc),
    // Indexable pages allow large image previews and full snippets in search results.
    m('name', 'robots', h.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'),
    m('property', 'og:site_name', SITE.name),
    m('property', 'og:locale', SITE.locale),
    m('property', 'og:type', h.ogType ?? 'website'),
    m('property', 'og:title', title),
    m('property', 'og:description', desc),
    m('property', 'og:url', url),
    m('property', 'og:image', absoluteUrl(img)),
    m('property', 'og:image:alt', imgAlt),
    ...(img === SITE.ogImage ? [m('property', 'og:image:width', '1200'), m('property', 'og:image:height', '630')] : []),
    m('name', 'twitter:card', 'summary_large_image'),
    m('name', 'twitter:title', title),
    m('name', 'twitter:description', desc),
    m('name', 'twitter:image', absoluteUrl(img)),
  ];
}

export function Seo(props: HeadData) {
  const collector = useContext(HeadCollector);
  if (collector) collector.set(props);

  useEffect(() => {
    const d = document;
    for (const t of headTags(props)) {
      if (t.kind === 'title') { d.title = t.value; continue; }
      let el = d.head.querySelector<HTMLMetaElement>(`meta[${t.attr}="${t.key}"]`);
      if (!el) {
        el = d.createElement('meta');
        el.setAttribute(t.attr, t.key);
        d.head.appendChild(el);
      }
      el.content = t.value;
    }
    // Size tags only apply to the default image.
    if (props.ogImage && props.ogImage !== SITE.ogImage) {
      d.head.querySelectorAll('meta[property="og:image:width"], meta[property="og:image:height"]').forEach((e) => e.remove());
    }
    let canonical = d.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = d.createElement('link');
      canonical.rel = 'canonical';
      d.head.appendChild(canonical);
    }
    canonical.href = absoluteUrl(props.path);
    d.head.querySelectorAll('script[data-seo-jsonld]').forEach((s) => s.remove());
    for (const block of props.jsonLd ?? []) {
      const s = d.createElement('script');
      s.type = 'application/ld+json';
      s.dataset.seoJsonld = '';
      s.textContent = JSON.stringify(block);
      d.head.appendChild(s);
    }
  }, [props]);

  return null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Serialize head data to HTML (prerender). */
export function renderHead(h: HeadData | undefined): string {
  if (!h) return '';
  const tags = headTags(h).map((t) => (t.kind === 'title' ? `<title>${esc(t.value)}</title>` : `<meta ${t.attr}="${t.key}" content="${esc(t.value)}" />`));
  tags.splice(2, 0, `<link rel="canonical" href="${esc(absoluteUrl(h.path))}" />`);
  for (const b of h.jsonLd ?? []) {
    tags.push(`<script type="application/ld+json" data-seo-jsonld>${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`);
  }
  return tags.join('\n    ');
}
