import { describe, expect, it } from 'vitest';
import { bookingRequestSchema, isAllowedName } from '@shared/schemas.ts';

describe('patient name rule (no links in SMS)', () => {
  it.each(['Abebe Kebede', 'አበበ ከበደ', "Mary-Jane O'Neil", 'Dr. Selam', 'Tigist  H.'])('accepts %s', (n) => {
    expect(isAllowedName(n)).toBe(true);
  });
  it.each(['Win at evil.com', 'see www.site', 'go https: now', 'a@b', 'x/y', 'Call 0911223344', '<script>'])('rejects %s', (n) => {
    expect(isAllowedName(n)).toBe(false);
  });
  it('the server request schema applies it', () => {
    const base = {
      locationId: '10000000-0000-4000-8000-000000000001', serviceId: '10000000-0000-4000-8000-000000000002', dentistId: null,
      startsAt: '2026-11-10T06:00:00+03:00', phone: '0911234567', turnstileToken: 't',
    };
    expect(bookingRequestSchema.safeParse({ ...base, fullName: 'Abebe Kebede' }).success).toBe(true);
    expect(bookingRequestSchema.safeParse({ ...base, fullName: 'Visit evil.com' }).success).toBe(false);
  });
});
