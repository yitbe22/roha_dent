import { createContext, useContext, useEffect } from 'react';
import { SITE, absoluteUrl } from '../content/site';

export type HeadData = {
  title: string;
  description?: string;
  path: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
  jsonLd?: Record<string, unknown>[];
};

/** During prerender, pages report their head tags here. In the browser it is null. */
export const HeadCollector = createContext<{ set: (h: HeadData) => void } | null>(null);

const fullTitle = (t: string) => (t.includes(SITE.shortName) || t.includes(SITE.name) ? t : `${t} | ${SITE.name}`);

export function Seo(props: HeadData) {
  const collector = useContext(HeadCollector);
  if (collector) collector.set(props);

  useEffect(() => {
    const d = document;
    d.title = fullTitle(props.title);
    const setMeta = (attr: 'name' | 'property', key: string, value?: string) => {
      let el = d.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!value) return el?.remove();
      if (!el) {
        el = d.createElement('meta');
        el.setAttribute(attr, key);
        d.head.appendChild(el);
      }
      el.content = value;
    };
    const desc = props.description ?? SITE.defaultDescription;
    const url = absoluteUrl(props.path);
    setMeta('name', 'description', desc);
    setMeta('name', 'robots', props.noindex ? 'noindex' : undefined);
    setMeta('property', 'og:title', fullTitle(props.title));
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', props.ogType ?? 'website');
    setMeta('property', 'og:image', absoluteUrl(props.ogImage ?? SITE.ogImage));
    let canonical = d.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = d.createElement('link');
      canonical.rel = 'canonical';
      d.head.appendChild(canonical);
    }
    canonical.href = url;
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
  const title = fullTitle(h.title);
  const desc = h.description ?? SITE.defaultDescription;
  const url = absoluteUrl(h.path);
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    h.noindex ? `<meta name="robots" content="noindex" />` : '',
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${esc(SITE.name)}" />`,
    `<meta property="og:locale" content="${SITE.locale}" />`,
    `<meta property="og:type" content="${h.ogType ?? 'website'}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(absoluteUrl(h.ogImage ?? SITE.ogImage))}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    ...(h.jsonLd ?? []).map(
      (b) => `<script type="application/ld+json" data-seo-jsonld>${JSON.stringify(b).replace(/</g, '\u003c')}</script>`,
    ),
  ];
  return tags.filter(Boolean).join('\n    ');
}
