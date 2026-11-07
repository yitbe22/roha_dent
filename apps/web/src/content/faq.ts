export type FaqGroup = { title: string; items: { q: string; a: string }[] };

export const faqGroups: FaqGroup[] = [
  {
    title: 'Booking and visits',
    items: [
      {
        q: 'How do I book an appointment?',
        a: 'Choose a clinic, treatment and time on the booking page, then enter your name and phone number. We send you an SMS once your appointment is confirmed. You can also call either clinic.',
      },
      {
        q: 'Can I change or cancel my appointment?',
        a: 'Yes. Your SMS contains a personal link where you can reschedule or cancel up to 2 hours before your visit. You can also call the clinic.',
      },
      {
        q: 'Do I need to create an account?',
        a: 'No. You only need a phone number that can receive SMS.',
      },
      {
        q: 'Which phone numbers can receive SMS?',
        a: 'Online booking currently works with Ethio Telecom mobile numbers starting with 09. If you use another network, please call the clinic to book.',
      },
      {
        q: 'What should I bring to my first visit?',
        a: 'Bring any previous dental X-rays, a list of medicines you take, and arrive about 10 minutes early.',
      },
    ],
  },
  {
    title: 'Payment',
    items: [
      {
        q: 'Do I pay online?',
        a: 'No. Booking is free and you pay at the clinic after your visit.',
      },
      {
        q: 'How much does treatment cost?',
        a: 'It depends on what your teeth need. After the examination the dentist explains the options and their cost before any treatment starts.',
      },
    ],
  },
  {
    title: 'Treatment',
    items: [
      {
        q: 'Do you treat children?',
        a: 'Yes. Our general dentists see children for check-ups, cleanings and fillings.',
      },
      {
        q: 'I have tooth pain. Can I be seen today?',
        a: 'Call the clinic directly. We keep time for urgent cases and will tell you the earliest time we can see you.',
      },
      {
        q: 'How often should I have my teeth cleaned?',
        a: 'Every six months for most people. If you have gum disease, the dentist may recommend more frequent cleanings.',
      },
    ],
  },
];
