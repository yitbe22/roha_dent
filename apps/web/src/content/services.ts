// Service pages. Slugs match the live rohadent.com URLs. Durations mirror supabase/seed.sql.

export type Service = {
  slug: string;
  name: string;
  shortName: string;
  summary: string;
  durationMinutes: number;
  intro: string[];
  goodFor: string[];
  visit: { title: string; body: string }[]; // a real sequence → rendered as numbered steps
  aftercare: string[];
  faq: { q: string; a: string }[];
  related: string[];
};

export const services: Service[] = [
  {
    slug: 'scaling',
    name: 'Scaling (Teeth Cleaning)',
    shortName: 'Teeth cleaning',
    summary: 'Removes hardened tartar and stains so your gums can heal and stay healthy.',
    durationMinutes: 45,
    intro: [
      'Even with careful brushing, plaque hardens into tartar along the gumline. Tartar can only be removed with professional instruments, and when it stays it causes bleeding gums, bad breath and, over time, loose teeth.',
      'Scaling uses an ultrasonic cleaner and fine hand instruments to remove it, followed by polishing to leave the surface smooth.',
    ],
    goodFor: ['Bleeding or swollen gums', 'Bad breath that does not go away', 'Visible tartar or tea and coffee stains', 'A routine check every six months'],
    visit: [
      { title: 'Check-up', body: 'The dentist examines your teeth and gums and points out any problem areas.' },
      { title: 'Scaling', body: 'Tartar is removed above and just below the gumline with an ultrasonic scaler.' },
      { title: 'Polishing', body: 'Teeth are polished to remove stains and make it harder for plaque to stick.' },
      { title: 'Advice', body: 'You get brushing and flossing tips for the areas that need extra care.' },
    ],
    aftercare: ['Gums may feel tender for a day or two. This is normal.', 'Avoid very hot or cold drinks for the rest of the day if your teeth feel sensitive.', 'Book your next cleaning in six months.'],
    faq: [
      { q: 'Does scaling damage the enamel?', a: 'No. Scaling removes tartar that sits on top of the tooth. The enamel itself is not removed.' },
      { q: 'Why do my gums bleed during cleaning?', a: 'Inflamed gums bleed easily. Once the tartar is gone and you keep the area clean, the bleeding usually stops within one to two weeks.' },
    ],
    related: ['teeth-whitening', 'root-canal'],
  },
  {
    slug: 'teeth-whitening',
    name: 'Tooth Whitening',
    shortName: 'Whitening',
    summary: 'A supervised whitening treatment that lightens your teeth by several shades in one visit.',
    durationMinutes: 60,
    intro: [
      'Coffee, tea, smoking and age gradually darken teeth. In-clinic whitening uses a professional gel applied under the dentist’s supervision, with your gums protected throughout.',
      'We record your shade before and after so you can see the difference.',
    ],
    goodFor: ['Yellowing from tea, coffee or smoking', 'A brighter smile before a wedding or event', 'Evening out colour after braces'],
    visit: [
      { title: 'Shade check', body: 'We record your current shade and confirm whitening is suitable for you.' },
      { title: 'Protection', body: 'A protective barrier is placed over your gums.' },
      { title: 'Whitening', body: 'The whitening gel is applied in short rounds.' },
      { title: 'Result', body: 'We compare your new shade and explain how to keep it.' },
    ],
    aftercare: ['For 48 hours, avoid tea, coffee, red sauces and smoking.', 'Mild sensitivity can occur for a day. A sensitive toothpaste helps.'],
    faq: [
      { q: 'Will whitening work on crowns or fillings?', a: 'No. Whitening only changes natural teeth. If you have visible crowns or fillings, we will discuss matching them afterwards.' },
      { q: 'How long does the result last?', a: 'Usually one to two years, depending on diet and smoking. Regular cleanings help it last longer.' },
    ],
    related: ['scaling', 'emax-crown'],
  },
  {
    slug: 'braces-invisible',
    name: 'Braces (Invisible / Clear Aligners)',
    shortName: 'Braces and aligners',
    summary: 'Straighten crowded or gapped teeth with clear aligners or modern braces.',
    durationMinutes: 45,
    intro: [
      'Clear aligners are a series of thin, transparent trays that move your teeth step by step. They are removable and hard to notice. For some bites, fixed braces are the better choice.',
      'Treatment starts with an orthodontic consultation, where we examine your bite and explain which option suits you, how long it will take and what it costs.',
    ],
    goodFor: ['Crowded or overlapping teeth', 'Gaps between teeth', 'Overbite, underbite or crossbite', 'Teeth that moved after earlier braces'],
    visit: [
      { title: 'Consultation', body: 'The orthodontist examines your teeth and bite and discusses your goals.' },
      { title: 'Records', body: 'Photos and impressions or scans are taken to plan your treatment.' },
      { title: 'Treatment plan', body: 'You receive a written plan with the expected duration and cost.' },
      { title: 'Fitting', body: 'Your first aligners or braces are fitted and you learn how to care for them.' },
    ],
    aftercare: ['Wear aligners about 22 hours a day and remove them only to eat and brush.', 'Come to each check-up so we can confirm your teeth are moving as planned.', 'Wear your retainer after treatment to keep the result.'],
    faq: [
      { q: 'Am I too old for braces?', a: 'No. Adults of any age with healthy gums can straighten their teeth.' },
      { q: 'How long does treatment take?', a: 'Most cases take between 6 and 18 months. You will know the estimate for your case after the consultation.' },
    ],
    related: ['scaling', 'teeth-whitening'],
  },
  {
    slug: 'root-canal',
    name: 'Root Canal Treatment',
    shortName: 'Root canal',
    summary: 'Treats infection inside the tooth, relieves pain and lets you keep your natural tooth.',
    durationMinutes: 90,
    intro: [
      'When decay or a crack reaches the nerve of a tooth, it becomes inflamed or infected. This causes throbbing pain, sensitivity that lingers, or swelling.',
      'Root canal treatment removes the infected tissue, cleans and shapes the canals and seals them. It is done under local anaesthetic and feels much like a normal filling.',
    ],
    goodFor: ['Strong or throbbing toothache', 'Pain with hot or cold that lasts', 'Swelling or a pimple on the gum', 'A darkened tooth after an injury'],
    visit: [
      { title: 'Diagnosis', body: 'An examination and X-ray show how far the infection has spread.' },
      { title: 'Anaesthetic', body: 'The tooth is numbed so you feel no pain during treatment.' },
      { title: 'Cleaning', body: 'Infected tissue is removed and the canals are cleaned and disinfected.' },
      { title: 'Sealing', body: 'The canals are filled and sealed. A crown is often recommended to protect the tooth.' },
    ],
    aftercare: ['The tooth may be tender for a few days. Normal painkillers help.', 'Avoid chewing hard food on that side until the final filling or crown is placed.'],
    faq: [
      { q: 'Is a root canal painful?', a: 'The treatment itself is done under anaesthetic. Most patients say it relieves the pain they came in with.' },
      { q: 'Why do I need a crown afterwards?', a: 'A treated back tooth becomes more brittle. A crown protects it from cracking.' },
    ],
    related: ['emax-crown', 'ceramic-crown'],
  },
  {
    slug: 'emax-crown',
    name: 'E.max Crown',
    shortName: 'E.max crown',
    summary: 'An all-ceramic crown that is strong and looks very close to a natural tooth.',
    durationMinutes: 60,
    intro: [
      'E.max crowns are made from lithium disilicate ceramic. They let light pass through like natural enamel, so they are a popular choice for front teeth, and they are strong enough for back teeth too.',
      'A crown covers a tooth that is broken, heavily filled, worn or treated with a root canal.',
    ],
    goodFor: ['Broken or cracked teeth', 'Teeth after root canal treatment', 'Front teeth with large fillings or discolouration'],
    visit: [
      { title: 'Preparation', body: 'The tooth is numbed and shaped to make room for the crown.' },
      { title: 'Impression', body: 'An impression is taken and the shade is matched to your teeth.' },
      { title: 'Temporary crown', body: 'A temporary crown protects the tooth while yours is made.' },
      { title: 'Fitting', body: 'At the second visit the E.max crown is checked, adjusted and bonded in place.' },
    ],
    aftercare: ['Brush and floss around the crown as you would a natural tooth.', 'Avoid biting very hard objects such as bones or bottle caps.'],
    faq: [
      { q: 'How many visits does a crown take?', a: 'Usually two: one to prepare the tooth and one to fit the crown, about a week apart.' },
      { q: 'E.max or ceramic crown?', a: 'E.max looks more natural and is often preferred for visible teeth. Your dentist will recommend the best option for each tooth.' },
    ],
    related: ['ceramic-crown', 'root-canal'],
  },
  {
    slug: 'ceramic-crown',
    name: 'Ceramic Crown',
    shortName: 'Ceramic crown',
    summary: 'A durable, tooth-coloured crown that restores the shape and strength of a damaged tooth.',
    durationMinutes: 60,
    intro: [
      'Ceramic crowns restore teeth that are too damaged for a filling. They are tooth-coloured and strong, and a reliable choice for back teeth that take heavy chewing forces.',
    ],
    goodFor: ['Back teeth with large fillings', 'Teeth after root canal treatment', 'Replacing old metal crowns'],
    visit: [
      { title: 'Preparation', body: 'The tooth is numbed and shaped.' },
      { title: 'Impression', body: 'An impression and shade match are taken.' },
      { title: 'Temporary crown', body: 'A temporary crown is placed.' },
      { title: 'Fitting', body: 'The final crown is fitted and cemented at the second visit.' },
    ],
    aftercare: ['Keep the gumline around the crown clean to prevent new decay.', 'Come for regular check-ups so we can check the fit.'],
    faq: [{ q: 'How long does a ceramic crown last?', a: 'With good care, most crowns last 10 to 15 years or longer.' }],
    related: ['emax-crown', 'root-canal'],
  },
  {
    slug: 'removable-denture',
    name: 'Removable Denture',
    shortName: 'Dentures',
    summary: 'Custom partial or full dentures that let you eat and smile with confidence again.',
    durationMinutes: 45,
    intro: [
      'A removable denture replaces several or all missing teeth. Partial dentures clip onto your remaining teeth. Full dentures rest on the gums.',
      'Each denture is made to fit your mouth, and we adjust it until it is comfortable.',
    ],
    goodFor: ['Several missing teeth', 'All teeth missing in one or both jaws', 'Replacing an old, loose denture'],
    visit: [
      { title: 'Assessment', body: 'We examine your gums and remaining teeth and discuss the options.' },
      { title: 'Impressions', body: 'Detailed impressions and bite records are taken.' },
      { title: 'Try-in', body: 'You try a wax version to check the fit, bite and appearance.' },
      { title: 'Fitting and adjustment', body: 'Your denture is fitted, and follow-up visits fine-tune the comfort.' },
    ],
    aftercare: ['Take the denture out at night and clean it daily.', 'Expect a few weeks to get used to eating and speaking with it.', 'Come back for an adjustment if anything rubs or feels loose.'],
    faq: [{ q: 'How many visits are needed?', a: 'Usually three to five visits over two to four weeks, depending on whether extractions are needed first.' }],
    related: ['ceramic-crown', 'scaling'],
  },
];

export const getService = (slug: string) => services.find((s) => s.slug === slug);
