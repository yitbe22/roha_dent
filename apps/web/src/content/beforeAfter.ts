// Before/after examples. ⚠ These are ILLUSTRATIVE: the "after" is a stock photo and the "before"
// is a digital simulation of it (see public/img/CREDITS.md). They are not Roha Dental patients,
// and the site says so on every pair. Replace with real cases (with written patient consent).
export type BeforeAfterCase = {
  slug: string;
  service: string; // service slug
  before: string;
  after: string;
  width: number;
  height: number;
  caption: string;
  illustrative: boolean;
};

export const beforeAfterCases: BeforeAfterCase[] = [
  {
    slug: 'whitening',
    service: 'teeth-whitening',
    before: '/img/before-after/whitening-before.webp',
    after: '/img/before-after/whitening-after.webp',
    width: 1200,
    height: 900,
    caption: 'Tooth whitening: how a shade change of several steps can look.',
    illustrative: true,
  },
];

export const casesFor = (service: string) => beforeAfterCases.filter((c) => c.service === service);
