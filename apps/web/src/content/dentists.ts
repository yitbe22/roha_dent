// ⚠ PLACEHOLDER profiles — mirror supabase/seed.sql. Replace names, bios and photos before launch.
export type Dentist = {
  slug: string;
  name: string;
  title: string;
  bio: string;
  locations: Array<'addis-ababa' | 'gonder'>;
  services: string[];
  languages: string[];
  photo?: string;
};

export const dentists: Dentist[] = [
  {
    slug: 'dr-selam-bekele',
    name: 'Dr. Selam Bekele',
    title: 'General and cosmetic dentist',
    bio: 'Focuses on preventive care and whitening, and helps patients plan smile improvements one step at a time.',
    locations: ['addis-ababa'],
    services: ['scaling', 'teeth-whitening', 'ceramic-crown', 'emax-crown'],
    languages: ['Amharic', 'English'],
  },
  {
    slug: 'dr-dawit-alemu',
    name: 'Dr. Dawit Alemu',
    title: 'Endodontist and restorative dentist',
    bio: 'Treats painful and infected teeth with root canal therapy and restores them with crowns.',
    locations: ['addis-ababa'],
    services: ['root-canal', 'emax-crown', 'ceramic-crown', 'scaling'],
    languages: ['Amharic', 'English'],
  },
  {
    slug: 'dr-meron-tadesse',
    name: 'Dr. Meron Tadesse',
    title: 'General dentist',
    bio: 'Looks after families in Gonder, from first cleanings to crowns and dentures.',
    locations: ['gonder'],
    services: ['scaling', 'teeth-whitening', 'root-canal', 'emax-crown', 'ceramic-crown', 'removable-denture'],
    languages: ['Amharic', 'English'],
  },
  {
    slug: 'dr-yonas-girma',
    name: 'Dr. Yonas Girma',
    title: 'Orthodontist',
    bio: 'Plans and supervises braces and clear aligner treatment. Sees patients in Addis Ababa on Mondays to Wednesdays and in Gonder on Thursdays to Saturdays.',
    locations: ['addis-ababa', 'gonder'],
    services: ['braces-invisible', 'scaling'],
    languages: ['Amharic', 'English'],
  },
];
