import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo';
import { Icon } from './Icon';
import { locations } from '../content/locations';
import { services } from '../content/services';
import { useReveal } from '../lib/useReveal';

const NAV = [
  { to: '/services', key: 'nav.services' },
  { to: '/doctors', key: 'nav.doctors' },
  { to: '/contact', key: 'nav.locations' },
  { to: '/faq', key: 'nav.faq' },
  { to: '/about', key: 'nav.about' },
] as const;

function Header() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const solid = scrolled || open;
  return (
    <header
      className={`sticky top-0 z-30 transition-[background-color,box-shadow] duration-300 ${
        solid ? 'bg-white shadow-[0_1px_0_var(--color-line)]' : 'bg-white'
      }`}
    >
      <div className="wrap flex h-16 items-center justify-between gap-6 lg:h-[4.25rem]">
        <Logo />
        <nav aria-label={t('nav.primary')} className="hidden lg:block">
          <ul className="flex items-center gap-7">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} className="grow-line block py-1.5 text-[0.9375rem] text-ink">
                  {t(n.key)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/book" className="btn-primary hidden min-h-11 pl-2 text-[0.9375rem] sm:inline-flex">
            <span className="btn-ic"><Icon name="calendar" className="size-4" /></span>
            {t('cta.book')}
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-line bg-white text-ink lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'close' : 'menu'} />
            <span className="sr-only">{open ? t('nav.close') : t('nav.menu')}</span>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label={t('nav.primary')} className="border-t border-line bg-white shadow-[0_18px_30px_-18px_rgb(15_35_80/0.25)] lg:hidden">
          <ul className="wrap flex flex-col py-2">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} className="flex min-h-13 items-center justify-between border-b border-line text-lg text-ink aria-[current=page]:text-roha-700">
                  {t(n.key)}
                  <Icon name="chevron" className="size-5 text-roha-300" />
                </NavLink>
              </li>
            ))}
            <li className="py-4">
              <Link to="/book" className="btn-primary w-full">{t('cta.book')}</Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="on-blue relative isolate mt-[clamp(3rem,6vw,5rem)] overflow-hidden bg-panel pb-28 text-white lg:pb-0">
      <img src="/img/logo-white.png" alt="" width={282} height={320} aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-10 -z-10 w-64 opacity-[0.08]" />
      <div className="wrap grid gap-12 pt-14 pb-12 md:grid-cols-[1.2fr_2fr_1fr] lg:pt-20">
        <div>
          <Logo tone="white" />
          <p className="mt-5 max-w-xs text-white/80">{t('footer.tagline')}</p>
        </div>
        <div className="grid gap-10 sm:grid-cols-2">
          {locations.map((l) => (
            <div key={l.slug}>
              <h2 className="text-sm font-medium tracking-normal text-white/80">{l.city}</h2>
              <ul className="mt-3 space-y-1.5 text-white/85">
                <li>
                  <a href={`tel:${l.phoneE164}`} className="font-display text-xl text-white decoration-adey decoration-2 underline-offset-4 hover:underline">{l.phoneDisplay}</a>
                </li>
                {l.hoursText.map((h) => <li key={h} className="text-[0.9375rem]">{h}</li>)}
                <li className="pt-1">
                  <Link to={`/locations/${l.slug}`} className="text-[0.9375rem] text-white underline decoration-white/40 underline-offset-4 hover:decoration-adey">
                    {t('cta.viewClinic')}
                  </Link>
                </li>
              </ul>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-1">
          <div>
            <h2 className="text-sm font-medium tracking-normal text-white/80">{t('footer.explore')}</h2>
            <ul className="mt-3 space-y-1.5 text-[0.9375rem]">
              {services.slice(0, 4).map((s) => (
                <li key={s.slug}><Link to={`/services/${s.slug}`} className="text-white decoration-adey decoration-2 underline-offset-4 hover:underline">{s.shortName}</Link></li>
              ))}
              <li><Link to="/services" className="text-white decoration-adey decoration-2 underline-offset-4 hover:underline">{t('cta.allServices')}</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-medium tracking-normal text-white/80">{t('footer.more')}</h2>
            <ul className="mt-3 space-y-1.5 text-[0.9375rem]">
              <li><Link to="/register" className="text-white decoration-adey decoration-2 underline-offset-4 hover:underline">{t('footer.register')}</Link></li>
              <li><Link to="/careers" className="text-white decoration-adey decoration-2 underline-offset-4 hover:underline">{t('footer.careers')}</Link></li>
              <li><Link to="/events" className="text-white decoration-adey decoration-2 underline-offset-4 hover:underline">{t('footer.events')}</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="wrap">
        <p className="border-t border-white/20 py-6 text-sm text-white/80">{t('footer.rights', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}

/** Phone-first: call either clinic or book, always one thumb away. */
function MobileActionBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  if (pathname.startsWith('/book')) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white lg:hidden">
      <div className="grid grid-cols-3 gap-2 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {locations.map((l) => (
          <a key={l.slug} href={`tel:${l.phoneE164}`} className="btn-ghost min-h-12 gap-1.5 px-2 text-sm">
            <Icon name="phone" className="size-4" />
            {l.city === 'Addis Ababa' ? 'Addis' : l.city}
          </a>
        ))}
        <Link to="/book" className="btn-primary min-h-12 px-2 text-sm">{t('cta.bookShort')}</Link>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  useReveal(pathname);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2">
        {t('nav.skip')}
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <MobileActionBar />
    </>
  );
}
