import { useEffect, type RefObject } from 'react';

// Scroll-scrubbed effects ported from the reference design (roha-dental-site.zip).
// Both are driven by scroll position, so they play forwards and backwards, and both are
// skipped entirely with prefers-reduced-motion (the elements then simply sit at rest).

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Runs `frame` on every scroll/resize (one per animation frame) while mounted. */
function useScrollFrame(frame: () => (() => void) | void, deps: unknown[]) {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let queued = false;
    let cleanup: (() => void) | void;
    const run = () => { cleanup = frame(); };
    const req = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; run(); });
    };
    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req);
    run();
    return () => {
      window.removeEventListener('scroll', req);
      window.removeEventListener('resize', req);
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * The panel under the hero grows to fill its frame as it scrolls up: it starts at 88% scale,
 * faded and more rounded, and settles at full size; the photo behind it drifts (parallax).
 */
export function useGrowPanel(panel: RefObject<HTMLElement | null>, bg: RefObject<HTMLElement | null>) {
  useScrollFrame(() => {
    const P = panel.current, B = bg.current;
    if (!P || !B) return;
    const vh = window.innerHeight;
    const r = P.getBoundingClientRect();
    const p = ease(clamp((vh - r.top) / (vh * 0.85)));
    P.style.transform = `scale(${(0.88 + 0.12 * p).toFixed(4)})`;
    P.style.borderRadius = `${lerp(44, 22, p).toFixed(1)}px`;
    P.style.opacity = (0.35 + 0.65 * p).toFixed(3);
    B.style.transform = `scale(1.14) translateY(${(((r.top + r.height / 2 - vh / 2) / vh) * -46).toFixed(1)}px)`;
    return () => {
      P.style.transform = P.style.borderRadius = P.style.opacity = '';
      B.style.transform = '';
    };
  }, [panel, bg]);
}

/**
 * Two decorations glide in from the left and right edges of a section as it scrolls into view,
 * sharpening from a blur, with a little drift and tilt tied to the section's position.
 */
export function useGlideIn(section: RefObject<HTMLElement | null>, left: RefObject<HTMLElement | null>, right: RefObject<HTMLElement | null>) {
  useScrollFrame(() => {
    const S = section.current, L = left.current, R = right.current;
    if (!S || !L || !R) return;
    const vh = window.innerHeight;
    const top = S.getBoundingClientRect().top;
    const p = ease(clamp((vh - top) / (vh * 0.75)));
    const q = top / vh;
    L.style.transform = `translate(${((1 - p) * -80).toFixed(1)}%, ${(q * 50).toFixed(1)}px) rotate(${(q * -10).toFixed(2)}deg)`;
    R.style.transform = `translate(${((1 - p) * 80).toFixed(1)}%, ${(q * -40).toFixed(1)}px) rotate(${(q * 8).toFixed(2)}deg)`;
    L.style.opacity = R.style.opacity = p.toFixed(3);
    L.style.filter = R.style.filter = `blur(${((1 - p) * 12).toFixed(1)}px)`;
    return () => {
      for (const el of [L, R]) el.style.transform = el.style.opacity = el.style.filter = '';
    };
  }, [section, left, right]);
}
