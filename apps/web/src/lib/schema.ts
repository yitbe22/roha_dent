// schema.org JSON-LD builders
import { SITE, absoluteUrl } from '../content/site';
import { locations, type Location } from '../content/locations';
import { services, type Service } from '../content/services';

const DAY: Record<string, string> = {
  Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday',
};

export const orgId = `${SITE.url}/#organization`;
export const locationId = (l: Location) => `${absoluteUrl(`/locations/${l.slug}`)}#dentist`;

export const websiteId = `${SITE.url}/#website`;

/** Tells Google the site's name (shown above results) and who publishes it. */
export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId,
    name: SITE.name,
    alternateName: SITE.shortName,
    url: `${SITE.url}/`,
    inLanguage: 'en',
    publisher: { '@id': orgId },
  };
}

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalOrganization',
    '@id': orgId,
    name: SITE.name,
    alternateName: SITE.shortName,
    url: SITE.url,
    description: SITE.defaultDescription,
    logo: { '@type': 'ImageObject', url: absoluteUrl(SITE.logo) },
    image: absoluteUrl(SITE.ogImage),
    medicalSpecialty: 'Dentistry',
    telephone: locations[0].phoneE164,
    areaServed: locations.map((l) => ({ '@type': 'City', name: l.city })),
    subOrganization: locations.map((l) => ({ '@id': locationId(l) })),
  };
}

/** A treatment as a schema.org MedicalProcedure (shared by the list and the detail page). */
const procedure = (s: Service) => ({
  '@type': 'MedicalProcedure',
  name: s.name,
  alternateName: s.shortName,
  url: absoluteUrl(`/services/${s.slug}`),
});

export function dentistLd(l: Location) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    '@id': locationId(l),
    name: l.name,
    url: absoluteUrl(`/locations/${l.slug}`),
    image: absoluteUrl(l.photo),
    logo: absoluteUrl(SITE.logo),
    description: l.intro,
    telephone: l.phoneE164,
    medicalSpecialty: 'Dentistry',
    isAcceptingNewPatients: true,
    availableService: services.map(procedure),
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
    ...procedure(s),
    description: s.summary,
    image: absoluteUrl(s.image),
    bodyLocation: 'Teeth',
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

/** The treatment list, so search engines see every treatment page from /services. */
export function servicesListLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Dental treatments at Roha Speciality Dental Center',
    itemListElement: services.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(`/services/${s.slug}`), name: s.name })),
  };
}
