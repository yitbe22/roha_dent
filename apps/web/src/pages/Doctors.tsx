import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Seo } from '../lib/seo';
import { breadcrumbLd } from '../lib/schema';
import { dentists } from '../content/dentists';
import { locations } from '../content/locations';
import { getService } from '../content/services';
import { PageIntro } from '../components/PageIntro';

export default function Doctors() {
  const { t } = useTranslation();
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Dentists', path: '/doctors' }];
  return (
    <>
      <Seo
        title="Our Dentists"
        description="Meet the dentists at Roha Speciality Dental Center in Addis Ababa and Gonder: general and cosmetic dentistry, root canal treatment, crowns and orthodontics."
        path="/doctors"
        jsonLd={[breadcrumbLd(crumbs)]}
      />
      <PageIntro
        crumbs={crumbs}
        title="Our dentists"
        lede="When you book, you can choose a dentist or take the first free time with anyone who offers the treatment."
      />
      <ul className="wrap mt-12 grid gap-x-10 gap-y-12 md:grid-cols-2">
        {dentists.map((d) => (
          <li key={d.slug} id={d.slug} className="grid grid-cols-[5rem_1fr] gap-5 sm:grid-cols-[7rem_1fr]">
            <div className="step-corner flex aspect-square items-center justify-center bg-mist text-2xl font-extrabold text-roha-700 sm:text-3xl" aria-hidden="true">
              {d.name.replace('Dr. ', '').split(' ').map((p) => p[0]).join('')}
            </div>
            <div>
              <h2 className="text-h3">{d.name}</h2>
              <p className="font-medium text-roha-600">{d.title}</p>
              <p className="mt-3 text-ink-soft">{d.bio}</p>
              <dl className="mt-4 grid gap-2 text-sm">
                <div className="flex gap-2">
                  <dt className="font-semibold">{t('common.worksAt')}:</dt>
                  <dd>{d.locations.map((s) => locations.find((l) => l.slug === s)!.city).join(', ')}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold">{t('common.treatments')}:</dt>
                  <dd>{d.services.map((s) => getService(s)?.shortName).join(', ')}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold">{t('common.languages')}:</dt>
                  <dd>{d.languages.join(', ')}</dd>
                </div>
              </dl>
              <Link to={`/book?dentist=${d.slug}`} className="link mt-4 inline-block">Book with {d.name.split(' ')[1]}</Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
