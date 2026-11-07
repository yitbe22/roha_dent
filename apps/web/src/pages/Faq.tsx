import { Seo } from '../lib/seo';
import { breadcrumbLd, faqLd } from '../lib/schema';
import { faqGroups } from '../content/faq';
import { PageIntro } from '../components/PageIntro';
import { CtaBand } from '../components/CtaBand';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const anchor = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

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
      <PageIntro
        crumbs={crumbs}
        title="Questions and answers"
        lede="Booking, changing an appointment, paying and what to expect. If your question is not here, call the clinic."
      />
      <div className="wrap mt-[clamp(2.5rem,5vw,4rem)] grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="Topics" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {faqGroups.map((g) => (
              <li key={g.title}>
                <a href={`#${anchor(g.title)}`}
                  className="block rounded-full px-4 py-2 ring-1 ring-line transition-colors hover:bg-page hover:text-roha-700 lg:rounded-inner lg:ring-0">
                  {g.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex max-w-3xl flex-col gap-[clamp(3rem,6vw,4.5rem)]">
          {faqGroups.map((g) => (
            <section key={g.title} id={anchor(g.title)} aria-labelledby={`${anchor(g.title)}-h`} data-reveal className="scroll-mt-24">
              <h2 id={`${anchor(g.title)}-h`} className="text-[clamp(1.5rem,2.6vw,2rem)] leading-tight">{g.title}</h2>
              <Accordion type="multiple" className="mt-3 border-t border-line">
                {g.items.map((f) => (
                  <AccordionItem key={f.q} value={f.q}>
                    <AccordionTrigger>{f.q}</AccordionTrigger>
                    <AccordionContent>{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>
      </div>
      <CtaBand title="Still have a question?" body="Call the clinic and ask. Or book a check-up, and the dentist will answer it in person." />
    </>
  );
}
