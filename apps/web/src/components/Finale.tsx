import { useEffect, type RefObject } from 'react';

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type FinaleRefs = {
  panel: RefObject<HTMLElement | null>;
  inner: RefObject<HTMLDivElement | null>;
  brand: RefObject<HTMLDivElement | null>;
  mark: RefObject<HTMLDivElement | null>;
  toTop: RefObject<HTMLButtonElement | null>;
  spacer: RefObject<HTMLDivElement | null>;
};

/**
 * Footer finale (as on the clinic's own site): the page holds still while the blue footer rises
 * over it and fills the screen; the columns fade, the logo grows from its footer spot to the
 * centre, and "Back to top" appears. Scroll-driven, so it plays both ways.
 * Off with reduced motion: the footer is then a normal footer.
 */
export function useFinale(refs: FinaleRefs, key: string) {
  // key = pathname: re-measure on every page
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Task pages keep a plain footer: the form's last button must never slide under it.
    if (/^\/(book|booking|b)(\/|$)/.test(key)) return;
    const root = document.documentElement;
    const main = document.getElementById('main');
    const { panel, inner, brand, mark, toTop, spacer } = refs;
    if (!main || !panel.current || !inner.current || !brand.current || !mark.current || !toTop.current || !spacer.current) return;
    const P = panel.current, I = inner.current, B = brand.current, M = mark.current, T = toTop.current, S = spacer.current;
    root.setAttribute('data-finale', '');

    let up = false;
    const frame = () => {
      const vh = window.innerHeight;
      // The page sticks once its bottom reaches the bottom of the screen, so the footer slides over it.
      main.style.top = `${Math.min(0, vh - main.offsetHeight)}px`;
      const footH = I.offsetHeight;
      const fits = footH <= vh;
      P.toggleAttribute('data-tall', !fits);
      P.style.height = `${Math.max(vh, footH)}px`;
      P.style.top = `${Math.min(0, vh - P.offsetHeight)}px`;

      const panelTop = P.getBoundingClientRect().top;
      // While the panel rises, its columns rest at the bottom of the screen.
      const restY = Math.max(0, vh - footH);
      const off = fits ? Math.max(0, restY - panelTop) : 0;
      I.style.transform = off ? `translateY(${off.toFixed(1)}px)` : '';
      const rise = fits ? clamp((restY - panelTop) / Math.max(1, restY)) : 0;
      const sp = S.getBoundingClientRect();
      const pin = clamp((vh - sp.top) / Math.max(1, sp.height));
      const fade = clamp(1 - rise * 1.7 - (fits ? 0 : pin * 2));
      I.style.opacity = fade.toFixed(3);
      I.style.pointerEvents = fade < 0.5 ? 'none' : '';

      // The logo grows from its place in the footer to the centre of the screen.
      const fb = B.getBoundingClientRect();
      const bw = M.offsetWidth, bh = M.offsetHeight;
      const s0 = fb.height / Math.max(1, bh);
      const e = ease(clamp(fits ? rise * 0.55 + pin * 0.75 : pin * 1.3));
      // Tall footer (phones): the real logo scrolls away; the big one fades in from the top once pinned.
      const sx = fb.left, sy = (fits ? fb.top : 24) - panelTop;
      M.style.opacity = fits ? '' : clamp(pin * 5).toFixed(3);
      const cx = window.innerWidth / 2 - bw / 2, cy = vh / 2 - bh / 2 - panelTop;
      M.style.transform = `translate(${lerp(sx, cx, e).toFixed(1)}px, ${lerp(sy, cy, e).toFixed(1)}px) scale(${lerp(s0, 1, e).toFixed(4)})`;

      const tt = clamp((pin - 0.55) / 0.3);
      T.style.opacity = tt.toFixed(3);
      T.style.pointerEvents = pin > 0.6 ? 'auto' : 'none';
      T.tabIndex = pin > 0.6 ? 0 : -1;

      const nowUp = rise > 0.08 || panelTop < vh * 0.3;
      if (nowUp !== up) {
        up = nowUp;
        root.toggleAttribute('data-footer-up', up);
      }
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
    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req);
    const ro = new ResizeObserver(req);
    ro.observe(main);
    ro.observe(I);
    frame();
    void document.fonts?.ready.then(req);

    return () => {
      window.removeEventListener('scroll', req);
      window.removeEventListener('resize', req);
      ro.disconnect();
      root.removeAttribute('data-finale');
      root.removeAttribute('data-footer-up');
      main.style.top = '';
      P.style.top = P.style.height = '';
      I.style.transform = I.style.opacity = I.style.pointerEvents = '';
      P.removeAttribute('data-tall');
    };
  }, [refs, key]);
}
