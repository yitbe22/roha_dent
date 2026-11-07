import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsLeftRight } from 'lucide-react';
import type { BeforeAfterCase } from '../content/beforeAfter';

/**
 * Drag-to-compare before/after photo. The control is a native range input stretched over
 * the image, so mouse, touch and keyboard (arrows, Home/End) all work without extra code.
 */
export function BeforeAfter({ item: c }: { item: BeforeAfterCase }) {
  const { t } = useTranslation();
  const [pos, setPos] = useState(50);
  const id = useId();
  return (
    <figure className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-panel bg-page select-none" style={{ aspectRatio: `${c.width} / ${c.height}` }}>
        <img src={c.after} alt={t('beforeAfter.afterAlt', { caption: c.caption })} width={c.width} height={c.height}
          loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
        <img src={c.before} alt={t('beforeAfter.beforeAlt', { caption: c.caption })} width={c.width} height={c.height}
          loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <span className="absolute top-3 left-3 rounded-full bg-ink/75 px-2.5 py-1 text-xs font-medium text-white">{t('beforeAfter.before')}</span>
        <span className="absolute top-3 right-3 rounded-full bg-ink/75 px-2.5 py-1 text-xs font-medium text-white">{t('beforeAfter.after')}</span>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_12px_rgb(0_0_0/0.35)]" style={{ left: `${pos}%` }}>
          <span className="absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-roha-700 shadow-[0_8px_20px_-6px_rgb(0_0_0/0.45)]">
            <ChevronsLeftRight className="size-5" />
          </span>
        </span>
        <input id={id} type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))}
          aria-label={t('beforeAfter.slider')} aria-valuetext={`${pos}%`}
          className="peer absolute inset-0 size-full cursor-ew-resize opacity-0" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-panel ring-ring peer-focus-visible:ring-2" />
      </div>
      <figcaption className="text-[0.9375rem]">
        <span className="block text-ink">{c.caption}</span>
        {c.illustrative && <span className="mt-1 block text-sm">{t('beforeAfter.illustrative')}</span>}
      </figcaption>
    </figure>
  );
}
