// schema.org JSON-LD builders
import { SITE, absoluteUrl } from '../content/site';
import { locations, type Location } from '../content/locations';
import type { Service } from '../content/services';

const DAY: Record<string, string> = {
  Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday',
};

export const orgId = `${SITE.url}/#organization`;
export const locationId = (l: Location) => `${absoluteUrl(`/locations/${l.slug}`)}#dentist`;

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalOrganization',
    '@id': orgId,
    name: SITE.name,
    url: SITE.url,
    logo: absoluteUrl('/favicon.svg'),
    medicalSpecialty: 'Dentistry',
    telephone: locations[0].phoneE164,
    subOrganization: locations.map((l) => ({ '@id': locationId(l) })),
  };
}

export function dentistLd(l: Location) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    '@id': locationId(l),
    name: l.name,
    url: absoluteUrl(`/locations/${l.slug}`),
    image: absoluteUrl(SITE.ogImage),
    telephone: l.phoneE164,
    priceRange: '$$',
    parentOrganization: { '@id': orgId },
    address: {
      '@type': 'PostalAddress',
      streetAddress: l.address.split(',')[0],
      addressLocality: l.city,
      addressCountry: 'ET',
    },
    geo: { '@type': 'GeoCoordinates', latitude: l.geo.lat, longitude: l.geo.lng },
    hasMap: l.mapUrl,
    openingHoursSpecification: l.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days.map((d) => DAY[d]),
      opens: h.opens,
      closes: h.closes,
    })),
    paymentAccepted: 'Cash',
    currenciesAccepted: 'ETB',
  };
}

export function serviceLd(s: Service) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalProcedure',
    name: s.name,
    description: s.summary,
    url: absoluteUrl(`/services/${s.slug}`),
    procedureType: 'https://schema.org/NoninvasiveProcedure',
    howPerformed: s.visit.map((v) => v.title).join(', '),
    provider: { '@id': orgId },
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  };
}

export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path),
    })),
  };
}
