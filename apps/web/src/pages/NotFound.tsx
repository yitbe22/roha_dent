import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Seo } from '../lib/seo';

export default function NotFound() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  return (
    <>
      <Seo title={t('notFound.title')} path={pathname} noindex />
      <div className="wrap py-24">
        <span className="step-cross block size-14 bg-mist" aria-hidden="true" />
        <h1 className="mt-8 text-h1">{t('notFound.title')}</h1>
        <p className="mt-5 max-w-xl text-lede text-ink-soft">{t('notFound.body')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/" className="btn-primary">{t('notFound.home')}</Link>
          <Link to="/book" className="btn-ghost">{t('cta.book')}</Link>
        </div>
      </div>
    </>
  );
}
