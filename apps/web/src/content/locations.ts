// Public location content. Mirrors supabase/seed.sql (the booking system reads the DB).
// ⚠ Addresses, coordinates and landmarks are PLACEHOLDERS — confirm before launch.

export type OpeningHours = { days: Array<'Mo' | 'Tu' | 'We' | 'Th' | 'Fr' | 'Sa' | 'Su'>; opens: string; closes: string };

export type Location = {
  slug: 'addis-ababa' | 'gonder';
  city: string;
  name: string;
  phoneDisplay: string;
  phoneE164: string;
  whatsapp: string; // digits only, for wa.me
  address: string;
  directions: string;
  mapUrl: string;
  geo: { lat: number; lng: number };
  /** Clinic photo (1600×1000), under public/. Stock stand-in until real photos arrive. */
  photo: string;
  photoAlt: string;
  hours: OpeningHours[];
  hoursText: string[];
  intro: string;
};

const MON_SAT: OpeningHours['days'] = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const locations: Location[] = [
  {
    slug: 'addis-ababa',
    photo: '/img/branches/addis-ababa.webp',
    photoAlt: 'Dental treatment chair in a bright clinic room',
    city: 'Addis Ababa',
    name: 'Roha Speciality Dental Center, Addis Ababa',
    phoneDisplay: '+251 94 604 0506',
    phoneE164: '+251946040506',
    whatsapp: '251946040506',
    address: 'Bole Road, Addis Ababa, Ethiopia',
    directions: 'On Bole Road, a short walk from the Bole Medhanialem area. Ask us for the exact building when you call.',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Roha+Speciality+Dental+Center+Addis+Ababa',
    geo: { lat: 9.0108, lng: 38.7613 },
    hours: [{ days: MON_SAT, opens: '08:30', closes: '17:30' }],
    hoursText: ['Monday to Saturday, 8:30 – 17:30', 'Sunday closed'],
    intro:
      'Our Addis Ababa clinic offers the full range of treatments, including orthodontic consultations with our visiting orthodontist on Mondays to Wednesdays.',
  },
  {
    slug: 'gonder',
    photo: '/img/branches/gonder.webp',
    photoAlt: 'Dental clinic room with treatment chairs and equipment',
    city: 'Gonder',
    name: 'Roha Speciality Dental Center, Gonder',
    phoneDisplay: '+251 92 364 5456',
    phoneE164: '+251923645456',
    whatsapp: '251923645456',
    address: 'Piazza, Gonder, Ethiopia',
    directions: 'In the Piazza area of central Gonder. Call us and we will guide you to the door.',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Roha+Speciality+Dental+Center+Gonder',
    geo: { lat: 12.603, lng: 37.4521 },
    hours: [{ days: MON_SAT, opens: '08:30', closes: '17:30' }],
    hoursText: ['Monday to Saturday, 8:30 – 17:30', 'Sunday closed'],
    intro:
      'Our Gonder clinic brings specialist dental care to North Gondar, with orthodontic consultations on Thursdays to Saturdays.',
  },
];

export const getLocation = (slug: string) => locations.find((l) => l.slug === slug);
