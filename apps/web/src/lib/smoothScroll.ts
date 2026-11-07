import { useEffect } from 'react';
import Lenis from 'lenis';

// Smooth wheel scrolling (Lenis), as on the reference design. The scroll-linked effects
// (reveals, the growing About panel, the footer finale) follow the scroll position, so with
// plain wheel steps they jump ~100px at a time; Lenis glides between them instead.
// Off with reduced motion, and on task pages (booking forms) and the staff dashboard.

let lenis: Lenis | null = null;

const TASK = /^\/(admin|book|booking|b)(\/|$)/;

/** Jump to the top at once, cancelling any glide in progress. */
export function jumpToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

/** Turn smooth scrolling on for public pages; key = pathname. */
export function useSmoothScroll(key: string) {
  const on = !TASK.test(key);
  useEffect(() => {
    if (!on || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const l = new Lenis({
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      anchors: { offset: -80 },
    });
    lenis = l;
    let raf = requestAnimationFrame(function loop(t) {
      l.raf(t);
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(raf);
      l.destroy();
      if (lenis === l) lenis = null;
    };
  }, [on]);
}
