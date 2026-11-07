import { useEffect, type CSSProperties } from 'react';

const INTRO_MS = 1500; // matches the #loader timing in styles.css

/**
 * Fades [data-reveal] blocks in as they scroll into view. Stagger with style={{ '--d': n }}.
 * Does nothing unless public/boot.js enabled it (motion allowed, script ran before paint).
 * Re-run on route change so the new page's blocks are observed.
 */
export function useReveal(key: string) {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains('js-reveal') || !('IntersectionObserver' in window)) {
      root.classList.remove('js-reveal');
      return;
    }
    root.classList.add('reveal-ready');

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    // While the intro screen is still up, wait so the first view animates in as it lifts.
    const wait = root.classList.contains('show-loader') ? Math.max(0, INTRO_MS - performance.now()) : 0;
    const timer = window.setTimeout(() => {
      document.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => io.observe(el));
    }, wait);
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, [key]);
}

/** Stagger index for a [data-reveal] block: style={stagger(2)}. */
export const stagger = (n: number) => ({ '--d': n }) as CSSProperties;
