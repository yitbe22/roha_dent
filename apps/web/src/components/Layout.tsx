import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo';
import { Icon } from './Icon';
import { locations } from '../content/locations';
import { services } from '../content/services';

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
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-enamel/95 backdrop-blur supports-[backdrop-filter]:bg-enamel/80">
      <div className="wrap flex h-16 items-center justify-between gap-4 lg:h-[4.5rem]">
        <Logo />
        <nav aria-label={t('nav.primary')} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 font-medium transition-colors hover:text-roha-700 ${
                      isActive ? 'text-roha-700 underline decoration-adey decoration-[3px] underline-offset-[10px]' : 'text-ink'
                    }`
                  }
                >
                  {t(n.key)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/book" className="btn-primary hidden sm:inline-flex">
            {t('cta.book')}
          </Link>
          <button
            type="button"
            className="btn-ghost px-3 lg:hidden"
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
        <nav id="mobile-nav" aria-label={t('nav.primary')} className="border-t border-line bg-enamel lg:hidden">
          <ul className="wrap flex flex-col py-2">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} className="flex min-h-12 items-center justify-between border-b border-line/60 text-lg font-semibold">
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
    <footer className="on-blue mt-24 bg-roha-800 pb-28 text-roha-100 lg:pb-0">
      <div className="wrap grid gap-12 py-16 md:grid-cols-[1.2fr_2fr_1fr]">
        <div>
          <Logo tone="white" />
          <p className="mt-4 max-w-xs text-roha-200">{t('footer.tagline')}</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          {locations.map((l) => (
            <div key={l.slug}>
              <h2 className="text-lg text-white">{l.city}</h2>
              <ul className="mt-3 space-y-2 text-roha-200">
                <li>
                  <a href={`tel:${l.phoneE164}`} className="font-semibold text-white hover:text-adey">{l.phoneDisplay}</a>
                </li>
                {l.hoursText.map((h) => <li key={h}>{h}</li>)}
                <li>
                  <Link to={`/locations/${l.slug}`} className="underline decoration-roha-500 underline-offset-4 hover:text-white">
                    {t('cta.viewClinic')}
                  </Link>
                </li>
              </ul>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-1">
          <div>
            <h2 className="text-lg text-white">{t('footer.explore')}</h2>
            <ul className="mt-3 space-y-2">
              {services.slice(0, 4).map((s) => (
                <li key={s.slug}><Link to={`/services/${s.slug}`} className="hover:text-white">{s.shortName}</Link></li>
              ))}
              <li><Link to="/services" className="hover:text-white">{t('cta.allServices')}</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-lg text-white">{t('footer.more')}</h2>
            <ul className="mt-3 space-y-2">
              <li><Link to="/register" className="hover:text-white">{t('footer.register')}</Link></li>
              <li><Link to="/careers" className="hover:text-white">{t('footer.careers')}</Link></li>
              <li><Link to="/events" className="hover:text-white">{t('footer.events')}</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="wrap py-6 text-sm text-roha-300">{t('footer.rights', { year: new Date().getFullYear() })}</p>
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
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-3 gap-2 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {locations.map((l) => (
          <a key={l.slug} href={`tel:${l.phoneE164}`} className="btn-ghost min-h-12 px-2 text-sm">
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
