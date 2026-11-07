import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, CalendarDays, Check, Clock, Wallet } from 'lucide-react';
import { Seo } from '../lib/seo';
import { breadcrumbLd, faqLd, serviceLd } from '../lib/schema';
import { stagger } from '../lib/useReveal';
import { getService } from '../content/services';
import { dentists } from '../content/dentists';
import { locations } from '../content/locations';
import { PageIntro } from '../components/PageIntro';
import { CtaBand } from '../components/CtaBand';
import { Monogram } from '../components/Monogram';
import NotFound from './NotFound';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';

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
  const cityOf = (slugs: string[]) => slugs.map((x) => locations.find((l) => l.slug === x)!.city).join(' and ');

  return (
    <>
      <Seo
        title={`${s.name} in Addis Ababa & Gonder`}
        description={`${s.summary} Book ${s.shortName.toLowerCase()} at Roha Speciality Dental Center in Addis Ababa or Gonder.`}
        path={`/services/${s.slug}`}
        jsonLd={[serviceLd(s), breadcrumbLd(crumbs), faqLd(s.faq)]}
      />
      <PageIntro crumbs={crumbs} title={s.name} lede={s.summary}>
        <div className="mt-6 flex flex-wrap gap-2">
          <Badge variant="secondary"><Clock data-icon="inline-start" />{t('common.visitLength', { count: s.durationMinutes })}</Badge>
          <Badge variant="secondary"><Wallet data-icon="inline-start" />Price confirmed at your exam</Badge>
        </div>
      </PageIntro>

      <div className="wrap mt-[clamp(2.5rem,5vw,4rem)] grid gap-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-20">
        <article className="flex max-w-[44rem] flex-col gap-[clamp(3rem,6vw,4.5rem)]">
          <section data-reveal className="flex flex-col gap-5 text-lg leading-relaxed text-ink">
            {s.intro.map((p) => <p key={p}>{p}</p>)}
          </section>

          <section aria-labelledby="good-for" data-reveal className="rounded-panel bg-page p-[clamp(1.5rem,4vw,2.5rem)]">
            <h2 id="good-for" className="text-[clamp(1.5rem,2.6vw,2rem)] leading-tight">When it helps</h2>
            <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {s.goodFor.map((g) => (
                <li key={g} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-roha-700 text-white" aria-hidden="true">
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </span>
                  <span className="text-ink">{g}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="visit" data-reveal>
            <h2 id="visit" className="text-[clamp(1.5rem,2.6vw,2rem)] leading-tight">What happens at your visit</h2>
            <ol className="mt-8 flex flex-col">
              {s.visit.map((v, i) => (
                <li key={v.title} className="relative grid grid-cols-[2.5rem_1fr] gap-x-5 pb-8 last:pb-0">
                  {i < s.visit.length - 1 && <span className="absolute top-11 bottom-1 left-5 w-px bg-line" aria-hidden="true" />}
                  <span className="grid size-10 place-items-center rounded-full bg-white font-display font-medium text-roha-700 tabular-nums ring-1 ring-roha-200">
                    {i + 1}
                  </span>
                  <div className="pt-1.5">
                    <h3 className="text-h3">{v.title}</h3>
                    <p className="mt-1.5">{v.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="after" data-reveal>
            <h2 id="after" className="text-[clamp(1.5rem,2.6vw,2rem)] leading-tight">Afterwards</h2>
            <ul className="mt-6 flex flex-col">
              {s.aftercare.map((a) => (
                <li key={a} className="border-b border-line py-4 first:border-t">{a}</li>
              ))}
            </ul>
          </section>

          {s.faq.length > 0 && (
            <section aria-labelledby="qa" data-reveal>
              <h2 id="qa" className="text-[clamp(1.5rem,2.6vw,2rem)] leading-tight">Questions</h2>
              <Accordion type="single" collapsible className="mt-4">
                {s.faq.map((f) => (
                  <AccordionItem key={f.q} value={f.q}>
                    <AccordionTrigger>{f.q}</AccordionTrigger>
                    <AccordionContent>{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          )}
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card data-reveal style={stagger(1)}>
            <CardHeader>
              <CardTitle>Book {s.shortName.toLowerCase()}</CardTitle>
              <CardDescription>Pick a clinic and a time online. We confirm by SMS, and you pay at the clinic.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Button asChild className="w-full">
                <Link to={`/book?service=${s.slug}`}><CalendarDays data-icon="inline-start" />{t('cta.book')}</Link>
              </Button>
              {team.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-ink">Who treats you</p>
                    <ul className="mt-3 flex flex-col gap-3">
                      {team.map((d) => (
                        <li key={d.slug} className="flex items-center gap-3">
                          <Monogram name={d.name} className="size-10 text-sm" />
                          <span className="leading-tight">
                            <span className="block font-medium text-ink">{d.name}</span>
                            <span className="text-sm">{cityOf(d.locations)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="text-sm">{t('common.payAtClinic')}</CardFooter>
          </Card>
        </aside>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-h" className="wrap mt-[clamp(4rem,9vw,7.5rem)]">
          <h2 id="related-h" data-reveal className="text-h2">Often booked with</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r, i) => (
              <li key={r.slug} data-reveal style={stagger(i + 1)} className="grid">
                <Link to={`/services/${r.slug}`}
                  className="group flex items-start justify-between gap-6 rounded-card p-6 ring-1 ring-line transition-[box-shadow,transform] duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgb(15_35_80/0.45)] hover:ring-roha-300">
                  <span>
                    <span className="block font-display text-xl leading-tight text-ink">{r.shortName}</span>
                    <span className="mt-2 block text-[0.9375rem]">{r.summary}</span>
                  </span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-roha-700 transition-colors group-hover:border-roha-700 group-hover:bg-roha-700 group-hover:text-white" aria-hidden="true">
                    <ArrowUpRight className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CtaBand bookTo={`/book?service=${s.slug}`} />
    </>
  );
}
