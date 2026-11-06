import { Seo } from '../lib/seo';
import { breadcrumbLd, faqLd } from '../lib/schema';
import { faqGroups } from '../content/faq';
import { PageIntro } from '../components/PageIntro';
import { Icon } from '../components/Icon';

export default function Faq() {
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'FAQ', path: '/faq' }];
  return (
    <>
      <Seo
        title="Frequently Asked Questions"
        description="Answers about booking, changing appointments, payment and treatments at Roha Speciality Dental Center."
        path="/faq"
        jsonLd={[breadcrumbLd(crumbs), faqLd(faqGroups.flatMap((g) => g.items))]}
      />
      <PageIntro crumbs={crumbs} title="Questions and answers" />
      <div className="wrap mt-12 max-w-3xl space-y-14">
        {faqGroups.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <h2 className="text-h2">{g.title}</h2>
            <div className="mt-5 divide-y divide-line border-y border-line">
              {g.items.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-roha-900">
                    {f.q}
                    <Icon name="plus" className="size-5 shrink-0 text-roha-500 transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="mt-3 text-ink-soft">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
