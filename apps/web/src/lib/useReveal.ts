import { useEffect, useLayoutEffect, type CSSProperties } from 'react';

import { INTRO_MS } from './intro';
import { clamp, ease } from './scrollFx';

type Item = { el: HTMLElement; off: number; text: boolean };

// Before paint on the client, so a new page's blocks never flash before their first frame.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const TEXT = /^(H1|H2|H3|H4|P|SPAN)$/;

function clear(el: HTMLElement) {
  el.style.opacity = el.style.transform = el.style.filter = '';
}

/**
 * Scroll-linked reveal, ported from the reference design: every [data-reveal] block washes in
 * from pale (10%), lower and blurred to sharp as it scrolls up into view, and back again when
 * you scroll up. It follows scroll position, so it plays every time, in both directions.
 * Stagger with style={stagger(n)}: each step starts the block a little later.
 *
 * Only on when public/boot.js added .js-reveal (motion allowed, script ran before paint).
 * Re-run on route change so the new page's blocks are picked up.
 */
export function useReveal(key: string) {
  useIsoLayoutEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains('js-reveal')) return;
    // Task pages (booking): a form must never sit half-faded while someone fills it in.
    if (/^\/(book|booking|b)(\/|$)/.test(key)) {
      root.classList.add('reveal-ready');
      return;
    }

    let items: Item[] = [];
    const collect = () => {
      items = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].map((el) => ({
        el,
        off: Math.min(Number(el.style.getPropertyValue('--d')) || 0, 6) * 0.07,
        text: TEXT.test(el.tagName),
      }));
    };

    const frame = () => {
      const vh = window.innerHeight;
      const span = vh * 0.42;
      const intro = root.classList.contains('hero-intro');
      // How far each block can still move up the screen. With the footer finale the page sticks
      // once its bottom reaches the bottom of the screen; otherwise the document just ends.
      const main = document.getElementById('main');
      const shift = root.hasAttribute('data-finale') && main
        ? Math.max(0, main.getBoundingClientRect().bottom - vh)
        : Math.max(0, root.scrollHeight - vh - window.scrollY);

      // Read every position first, then write, so the browser lays out once per frame.
      const reads = items.map(({ el, off }) => {
        if (intro && el.closest('.hero')) return -1;
        const r = el.getBoundingClientRect();
        if (r.bottom < -50) return 1;
        const start = vh - off * span;
        // Blocks near the end of the page may never reach the usual finish line: finish them
        // where they stop instead.
        const end = Math.max(start - span, r.top - shift);
        if (start - end < 40) return 1;
        return ease(clamp((start - r.top) / (start - end)));
      });

      items.forEach(({ el, text }, i) => {
        const p = reads[i];
        if (p < 0 || p >= 1) return clear(el);
        el.style.opacity = (0.1 + 0.9 * p).toFixed(3);
        el.style.transform = `translateY(${((1 - p) * 42).toFixed(1)}px)`;
        if (text) el.style.filter = `blur(${((1 - p) * 7).toFixed(2)}px)`;
      });
    };

    let queued = false;
    const req = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        frame();
      });
    };
    const ro = new ResizeObserver(() => {
      collect();
      req();
    });

    let started = false;
    const start = () => {
      started = true;
      collect();
      frame();
      root.classList.add('reveal-ready');
      window.addEventListener('scroll', req, { passive: true });
      window.addEventListener('resize', req);
      const main = document.getElementById('main');
      if (main) ro.observe(main);
    };
    // While the intro screen is still up, wait so the first view washes in as it lifts.
    const wait = root.classList.contains('show-loader') ? Math.max(0, INTRO_MS - performance.now()) : 0;
    const timer = wait > 0 ? window.setTimeout(start, wait) : (start(), 0);

    return () => {
      window.clearTimeout(timer);
      if (!started) return;
      window.removeEventListener('scroll', req);
      window.removeEventListener('resize', req);
      ro.disconnect();
      items.forEach(({ el }) => clear(el));
    };
  }, [key]);
}

/** Stagger index for a [data-reveal] block: style={stagger(2)}. */
export const stagger = (n: number) => ({ '--d': n }) as CSSProperties;
