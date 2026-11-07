import { useEffect, useRef } from 'react';

/**
 * A number that counts up from 0 when it scrolls into view (as on the reference design).
 *
 * SEO and accessibility: the real value is always in the HTML. It is server-rendered and
 * prerendered, and never replaced by a placeholder "0" ahead of time, so crawlers, no-JS
 * visitors and link previews all read the final number. Screen readers get it once from a
 * visually hidden copy; the animating digits are aria-hidden so they aren't announced
 * mid-count. Non-numeric values ("Mon–Sat") render as plain text. Skipped with
 * reduced motion.
 */
export function CountUp({ value, duration = 1700 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const m = /^(\D*)(\d+)(.*)$/.exec(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || !m || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const [, pre, num, suf] = m;
    const to = Number(num);
    let raf = 0;
    // Counts up every time it comes into view; resets once it has fully left.
    let playing = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) {
          playing = false;
          return;
        }
        if (playing || e.intersectionRatio < 0.6) return;
        playing = true;
        cancelAnimationFrame(raf);
        const t0 = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - t0) / duration);
          el.textContent = `${pre}${Math.round(to * (1 - Math.pow(1 - t, 3)))}${suf}`;
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: [0, 0.6] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.textContent = value;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  if (!m) return <>{value}</>;
  return (
    <>
      <span className="sr-only">{value}</span>
      <span ref={ref} aria-hidden="true">{value}</span>
    </>
  );
}
