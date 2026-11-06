import { services } from './content/services';
import { locations } from './content/locations';

/** Every public URL that is prerendered and listed in sitemap.xml. */
export const PUBLIC_ROUTES: { path: string; priority: number }[] = [
  { path: '/', priority: 1.0 },
  { path: '/book', priority: 0.9 },
  { path: '/services', priority: 0.9 },
  ...services.map((s) => ({ path: `/services/${s.slug}`, priority: 0.8 })),
  { path: '/contact', priority: 0.8 },
  ...locations.map((l) => ({ path: `/locations/${l.slug}`, priority: 0.8 })),
  { path: '/doctors', priority: 0.7 },
  { path: '/about', priority: 0.6 },
  { path: '/faq', priority: 0.6 },
  { path: '/register', priority: 0.4 },
  { path: '/careers', priority: 0.3 },
  { path: '/events', priority: 0.3 },
];
