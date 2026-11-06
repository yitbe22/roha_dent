import { describe, expect, it } from 'vitest';
import { renderTemplate, SAMPLE_VARS, smsInfo } from '@shared/sms.ts';

describe('smsInfo (segments and encoding)', () => {
  it('plain text fits one GSM-7 part up to 160 chars', () => {
    expect(smsInfo('a'.repeat(160))).toMatchObject({ encoding: 'gsm7', units: 160, segments: 1 });
    expect(smsInfo('a'.repeat(161))).toMatchObject({ encoding: 'gsm7', segments: 2, perSegment: 153 });
    expect(smsInfo('a'.repeat(306))).toMatchObject({ segments: 2 });
    expect(smsInfo('a'.repeat(307))).toMatchObject({ segments: 3 });
  });
  it('GSM extended characters cost two septets', () => {
    expect(smsInfo('€'.repeat(80))).toMatchObject({ encoding: 'gsm7', units: 160, segments: 1 });
    expect(smsInfo('{'.repeat(81))).toMatchObject({ encoding: 'gsm7', units: 162, segments: 2 });
  });
  it('Amharic switches to UCS-2 (70 per part, 67 when split)', () => {
    const am = 'ሰላም';
    expect(smsInfo(am)).toMatchObject({ encoding: 'ucs2', units: 3, segments: 1 });
    expect(smsInfo('ሀ'.repeat(70))).toMatchObject({ segments: 1, perSegment: 70 });
    expect(smsInfo('ሀ'.repeat(71))).toMatchObject({ segments: 2, perSegment: 67 });
  });
  it('one stray character (en dash, curly quote, emoji) forces UCS-2 and reports it', () => {
    const r = smsInfo('Mon–Sat');
    expect(r.encoding).toBe('ucs2');
    expect(r.nonGsm).toEqual(['–']);
    expect(smsInfo('Hi 😀').units).toBe(5); // emoji = 2 UTF-16 units
  });
  it('empty text is zero parts', () => {
    expect(smsInfo('').segments).toBe(0);
  });
});

describe('renderTemplate', () => {
  it('replaces known placeholders, keeps unknown ones', () => {
    expect(renderTemplate('Hi {patient_name}, {time} {unknown}', { patient_name: 'Abebe', time: '09:30' })).toBe('Hi Abebe, 09:30 {unknown}');
  });
  it('null/undefined render as empty', () => {
    expect(renderTemplate('[{a}]', { a: null })).toBe('[]');
  });
});

describe('default English templates stay GSM-7 (cheap) with realistic values', () => {
  // Same text as migration 0006.
  const templates = {
    booking_received: 'Roha Dental: Hi {patient_name}, we received your request for {service} on {date} at {time}, {location}. We will confirm by SMS. Manage: {manage_link}',
    booking_confirmed: 'Roha Dental: {patient_name}, your {service} appointment is confirmed for {date} at {time}, {location}. Change or cancel: {manage_link}',
    reminder_2h: 'Roha Dental: see you today at {time}, {location}. Questions: {location_phone}',
  };
  for (const [key, body] of Object.entries(templates)) {
    it(key, () => {
      const info = smsInfo(renderTemplate(body, SAMPLE_VARS));
      expect(info.encoding).toBe('gsm7');
      expect(info.segments).toBeLessThanOrEqual(2);
    });
  }
});
