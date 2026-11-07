import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsLeftRight } from 'lucide-react';
import type { BeforeAfterCase } from '../content/beforeAfter';

/**
 * Drag-to-compare before/after photo. The control is a native range input stretched over
 * the image, so mouse, touch and keyboard (arrows, Home/End) all work without extra code.
 *
 * To show visitors what to do (as on the reference design), the handle swings left and right
 * by itself each time the photo comes into view, until they move it themselves.
 */
export function BeforeAfter({ item: c }: { item: BeforeAfterCase }) {
  const { t } = useTranslation();
  const [pos, setPos] = useState(50);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    const el = box.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    let raf = 0;
    let shown = false;
    const sweep = () => {
      const t0 = performance.now();
      const f = (now: number) => {
        if (touched.current) return;
        const k = Math.min(1, (now - t0) / 2600);
        setPos(Math.round((50 + Math.sin(k * Math.PI * 2) * 38 * (1 - k)) * 10) / 10);
        if (k < 1) raf = requestAnimationFrame(f);
      };
      raf = requestAnimationFrame(f);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) {
          shown = false;
          return;
        }
        if (shown || e.intersectionRatio < 0.6 || touched.current) return;
        shown = true;
        cancelAnimationFrame(raf);
        sweep();
      },
      { threshold: [0, 0.6] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const stop = () => { touched.current = true; };

  return (
    <figure className="flex flex-col gap-3">
      <div ref={box} className="relative overflow-hidden rounded-panel bg-page select-none" style={{ aspectRatio: `${c.width} / ${c.height}` }}>
        <img src={c.after} alt={t('beforeAfter.afterAlt', { caption: c.caption })} width={c.width} height={c.height}
          loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
        <img src={c.before} alt={t('beforeAfter.beforeAlt', { caption: c.caption })} width={c.width} height={c.height}
          loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <span className="absolute top-3 left-3 rounded-md bg-ink/50 px-2 py-1 text-xs font-medium text-white">{t('beforeAfter.before')}</span>
        <span className="absolute top-3 right-3 rounded-md bg-ink/50 px-2 py-1 text-xs font-medium text-white">{t('beforeAfter.after')}</span>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[#9cc4ff]" style={{ left: `${pos}%` }} />
        <input id={id} type="range" min={0} max={100} step={0.1} value={pos}
          onChange={(e) => setPos(Number(e.target.value))} onPointerDown={stop} onKeyDown={stop}
          aria-label={t('beforeAfter.slider')} aria-valuetext={`${Math.round(pos)}%`}
          className="peer absolute inset-0 size-full cursor-ew-resize opacity-0" />
        {/* Frosted knob, as on the reference */}
        <span aria-hidden="true" style={{ left: `${pos}%` }}
          className="pointer-events-none absolute top-[58%] grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/35 text-white backdrop-blur-md peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-white">
          <ChevronsLeftRight className="size-[1.125rem]" />
        </span>
      </div>
      <figcaption className="text-[0.9375rem]">
        <span className="block text-ink">{c.caption}</span>
        {c.illustrative && <span className="mt-1 block text-sm">{t('beforeAfter.illustrative')}</span>}
      </figcaption>
    </figure>
  );
}
