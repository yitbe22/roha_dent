import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Seo } from '../lib/seo';
import { breadcrumbLd, faqLd, serviceLd } from '../lib/schema';
import { getService } from '../content/services';
import { dentists } from '../content/dentists';
import { PageIntro } from '../components/PageIntro';
import { Icon } from '../components/Icon';
import NotFound from './NotFound';

export default function ServiceDetail() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const s = getService(slug);
  if (!s) return <NotFound />;

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: s.shortName, path: `/services/${s.slug}` },
  ];
  const team = dentists.filter((d) => d.services.includes(s.slug));
  const related = s.related.map(getService).filter((x) => !!x);

  return (
    <>
      <Seo
        title={`${s.name} in Addis Ababa & Gonder`}
        description={`${s.summary} Book ${s.shortName.toLowerCase()} at Roha Speciality Dental Center in Addis Ababa or Gonder.`}
        path={`/services/${s.slug}`}
        jsonLd={[serviceLd(s), breadcrumbLd(crumbs), faqLd(s.faq)]}
      />
      <PageIntro crumbs={crumbs} title={s.name} lede={s.summary}>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to={`/book?service=${s.slug}`} className="btn-primary px-6">
            <Icon name="calendar" />
            {t('cta.book')}
          </Link>
          <span className="flex items-center gap-2 text-ink-soft">
            <Icon name="clock" className="size-5 text-roha-500" />
            {t('common.visitLength', { count: s.durationMinutes })}
          </span>
        </div>
      </PageIntro>

      <div className="wrap mt-14 grid gap-14 lg:grid-cols-[2fr_1fr]">
        <article className="max-w-prose space-y-14">
          <section className="space-y-4 text-lg">
            {s.intro.map((p) => <p key={p}>{p}</p>)}
          </section>

          <section aria-labelledby="good-for">
            <h2 id="good-for" className="text-h2">When it helps</h2>
            <ul className="mt-5 space-y-3">
              {s.goodFor.map((g) => (
                <li key={g} className="flex gap-3">
                  <Icon name="check" className="mt-1 size-5 shrink-0 text-roha-600" />
                  {g}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="visit">
            <h2 id="visit" className="text-h2">What happens at your visit</h2>
            <ol className="mt-6 space-y-6 border-l-2 border-mist pl-6">
              {s.visit.map((v, i) => (
                <li key={v.title} className="relative">
                  <span className="step-cross absolute -left-[2.45rem] top-0 flex size-7 items-center justify-center bg-roha-700 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-bold">{v.title}</h3>
                  <p className="mt-1 text-ink-soft">{v.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="after">
            <h2 id="after" className="text-h2">Afterwards</h2>
            <ul className="mt-5 list-disc space-y-2 pl-5 marker:text-roha-300">
              {s.aftercare.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </section>

          <section aria-labelledby="qa">
            <h2 id="qa" className="text-h2">Questions</h2>
            <div className="mt-5 divide-y divide-line border-y border-line">
              {s.faq.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-roha-900">
                    {f.q}
                    <Icon name="plus" className="size-5 shrink-0 text-roha-500 transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="mt-3 text-ink-soft">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </article>

        <aside className="space-y-10 lg:sticky lg:top-28 lg:self-start">
          <div className="step-corner bg-mist p-6">
            <h2 className="text-lg font-bold">Who treats you</h2>
            <ul className="mt-4 space-y-3">
              {team.map((d) => (
                <li key={d.slug}>
                  <p className="font-semibold text-roha-900">{d.name}</p>
                  <p className="text-sm text-ink-soft">{d.title}</p>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-roha-200 pt-4 text-sm text-ink-soft">{t('common.payAtClinic')}</p>
          </div>
          {related.length > 0 && (
            <div>
              <h2 className="text-lg font-bold">Related treatments</h2>
              <ul className="mt-3 space-y-2">
                {related.map((r) => (
                  <li key={r.slug}><Link to={`/services/${r.slug}`} className="link">{r.name}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
