import { describe, expect, it } from 'vitest';
import { formatEthiopianPhone, normalizeEthiopianPhone, toMsisdn } from '@shared/phone.ts';

describe('normalizeEthiopianPhone', () => {
  it.each([
    ['0911234567', '+251911234567'],
    ['911234567', '+251911234567'],
    ['251911234567', '+251911234567'],
    ['+251911234567', '+251911234567'],
    ['00251911234567', '+251911234567'],
    ['+251 91 123 4567', '+251911234567'],
    ['091-123-4567', '+251911234567'],
    ['(091) 123 4567', '+251911234567'],
    [' 0946040506 ', '+251946040506'],
    ['+2510911234567', '+251911234567'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeEthiopianPhone(input)).toEqual({ ok: true, e164: expected });
  });

  it.each(['0711234567', '+251711234567', '711234567'])('rejects Safaricom %s as UNSUPPORTED_NETWORK', (input) => {
    expect(normalizeEthiopianPhone(input)).toEqual({ ok: false, error: 'UNSUPPORTED_NETWORK' });
  });

  it.each(['', '   ', null, undefined])('rejects empty %p', (input) => {
    expect(normalizeEthiopianPhone(input)).toEqual({ ok: false, error: 'EMPTY' });
  });

  it.each([
    '091123456', // too short
    '09112345678', // too long
    '0111234567', // Addis landline
    '+1 202 555 0100', // foreign
    '+25591123456', // wrong country code
    '09l1234567', // letter
    '0911+234567',
    '0811234567',
  ])('rejects invalid %s', (input) => {
    expect(normalizeEthiopianPhone(input)).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('format helpers', () => {
  it('toMsisdn strips the plus for SMS Ethiopia', () => {
    expect(toMsisdn('+251911234567')).toBe('251911234567');
  });
  it('formats for display', () => {
    expect(formatEthiopianPhone('+251946040506')).toBe('+251 94 604 0506');
    expect(formatEthiopianPhone('garbage')).toBe('garbage');
  });
});
