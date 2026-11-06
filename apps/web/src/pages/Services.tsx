import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Seo } from '../lib/seo';
import { breadcrumbLd } from '../lib/schema';
import { services } from '../content/services';
import { PageIntro } from '../components/PageIntro';

export default function Services() {
  const { t } = useTranslation();
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Services', path: '/services' }];
  return (
    <>
      <Seo
        title="Dental Services in Addis Ababa & Gonder"
        description="Teeth cleaning, whitening, clear aligners and braces, root canal treatment, E.max and ceramic crowns, and removable dentures at Roha Speciality Dental Center."
        path="/services"
        jsonLd={[breadcrumbLd(crumbs)]}
      />
      <PageIntro
        crumbs={crumbs}
        title="Treatments"
        lede="Every treatment starts with an examination, where the dentist explains what your teeth need and what it will cost. Nothing is done without your agreement."
      />
      <div className="wrap mt-12">
        <ul className="grid gap-x-12 border-t border-line md:grid-cols-2">
          {services.map((s) => (
            <li key={s.slug} className="border-b border-line py-7">
              <h2 className="text-h3">
                <Link to={`/services/${s.slug}`} className="hover:text-roha-700 hover:underline hover:decoration-adey hover:decoration-2 hover:underline-offset-4">
                  {s.name}
                </Link>
              </h2>
              <p className="mt-2 max-w-prose text-ink-soft">{s.summary}</p>
              <p className="mt-3 text-sm font-semibold text-roha-600">{t('common.visitLength', { count: s.durationMinutes })}</p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                <Link to={`/services/${s.slug}`} className="link">{t('cta.learnMore', { name: s.shortName.toLowerCase() })}</Link>
                <Link to={`/book?service=${s.slug}`} className="link">{t('cta.book')}</Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
