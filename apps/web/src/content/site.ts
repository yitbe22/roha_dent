export const SITE = {
  name: 'Roha Speciality Dental Center',
  shortName: 'Roha Dental',
  url: (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || 'https://rohadent.com',
  defaultDescription:
    'Specialist dental care in Addis Ababa and Gonder: cleaning, whitening, clear aligners, root canal treatment, crowns and dentures. Book online or call.',
  ogImage: '/og-default.png',
  locale: 'en_ET',
} as const;

export const absoluteUrl = (path: string) => `${SITE.url}${path === '/' ? '' : path}`;
