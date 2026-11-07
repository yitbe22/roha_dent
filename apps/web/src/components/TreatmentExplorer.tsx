import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { services } from '../content/services';
import { Icon } from './Icon';

/**
 * Pick a treatment on the left (tabs), read it on the right: what it is, who it is for,
 * how long it takes, and book it straight away. On phones the tabs become a scrolling row.
 */
export function TreatmentExplorer() {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const s = services[active];

  const select = (i: number, focus = false) => {
    const n = (i + services.length) % services.length;
    setActive(n);
    if (focus) {
      tabs.current[n]?.focus();
      tabs.current[n]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  };
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (step) { e.preventDefault(); select(active + step, true); }
    if (e.key === 'Home') { e.preventDefault(); select(0, true); }
    if (e.key === 'End') { e.preventDefault(); select(services.length - 1, true); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] lg:gap-6">
      <div
        role="tablist"
        aria-label="Treatments"
        aria-orientation="vertical"
        onKeyDown={onKey}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:p-0"
      >
        {services.map((x, i) => {
          const on = i === active;
          return (
            <button
              key={x.slug}
              ref={(el) => { tabs.current[i] = el; }}
              role="tab"
              id={`tx-tab-${x.slug}`}
              aria-selected={on}
              aria-controls="tx-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => select(i)}
              className={`group relative flex shrink-0 items-center justify-between gap-4 rounded-full border px-4 py-2.5 text-left transition-colors duration-300 lg:rounded-card lg:border-transparent lg:px-5 lg:py-4 ${
                on
                  ? 'border-roha-700 bg-roha-700 text-white lg:border-line lg:bg-white lg:text-ink lg:shadow-[0_12px_30px_-18px_rgb(15_35_80/0.35)]'
                  : 'border-line bg-white text-ink hover:border-roha-300 lg:bg-transparent lg:hover:bg-white/70'
              }`}
            >
              <span
                className={`absolute top-1/2 left-0 hidden h-7 w-[3px] -translate-y-1/2 rounded-full bg-sky transition-opacity lg:block ${on ? 'opacity-100' : 'opacity-0'}`}
                aria-hidden="true"
              />
              <span className="font-display text-[0.9375rem] font-medium whitespace-nowrap lg:text-lg lg:whitespace-normal">{x.shortName}</span>
              <span className={`hidden text-sm tabular-nums lg:inline ${on ? 'text-roha-600' : 'text-muted'}`}>
                {t('common.minutes', { count: x.durationMinutes })}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id="tx-panel"
        role="tabpanel"
        aria-labelledby={`tx-tab-${s.slug}`}
        className="on-blue relative isolate overflow-hidden rounded-panel bg-[linear-gradient(150deg,var(--color-panel-2),var(--color-panel)_45%,var(--color-roha-700))] p-[clamp(1.5rem,4vw,3rem)] text-white"
      >
        <img src="/img/logo-white.png" alt="" width={282} height={320} aria-hidden="true"
          className="pointer-events-none absolute -right-10 -bottom-12 -z-10 w-56 opacity-[0.07] lg:w-72" />
        {/* key → the content re-enters on every change */}
        <div key={s.slug} className="animate-[tx-in_0.55s_var(--ease-out-soft)]">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-medium text-roha-700">
              <Icon name="clock" className="size-4" />
              {t('common.visitLength', { count: s.durationMinutes })}
            </span>
            <span className="rounded-full bg-white px-3 py-1 font-medium text-roha-700">
              {s.visit.length} steps at your visit
            </span>
          </div>
          <h3 className="mt-6 max-w-[18ch] font-display text-[clamp(1.75rem,3.2vw,2.75rem)] leading-[1.04] text-white">{s.name}</h3>
          <p className="mt-4 max-w-[48ch] text-lg text-white/90">{s.summary}</p>

          <div className="mt-8 grid gap-6 sm:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-sm font-medium text-white/80">Good for</p>
              <ul className="mt-3 grid gap-2">
                {s.goodFor.slice(0, 4).map((g) => (
                  <li key={g} className="flex gap-2.5 text-[0.9375rem]">
                    <Icon name="check" className="mt-0.5 size-4 shrink-0 text-sky-soft" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-white/80">At your visit</p>
              <ol className="mt-3 grid gap-2">
                {s.visit.slice(0, 4).map((v, i) => (
                  <li key={v.title} className="flex items-center gap-2.5 text-[0.9375rem]">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-medium text-roha-700 tabular-nums">{i + 1}</span>
                    {v.title}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link to={`/book?service=${s.slug}`} className="btn-light pl-2">
              <span className="btn-ic bg-roha-100"><Icon name="calendar" className="size-4" /></span>
              {t('cta.bookThis', { name: s.shortName.toLowerCase() })}
            </Link>
            <Link to={`/services/${s.slug}`} className="btn-ghost-blue">{t('cta.learnMore', { name: s.shortName.toLowerCase() })}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
