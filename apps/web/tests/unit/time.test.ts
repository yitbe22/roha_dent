import { describe, expect, it } from 'vitest';
import {
  addDays, clinicDateKey, clinicHour, formatClinicDate, formatClinicTime, groupSlots, partOfDay, splitByPartOfDay, weekdayOfKey,
} from '@shared/time.ts';

describe('clinic timezone (Africa/Addis_Ababa, UTC+3, no DST)', () => {
  it('maps UTC instants to the clinic calendar date', () => {
    expect(clinicDateKey('2026-11-09T20:59:00Z')).toBe('2026-11-09'); // 23:59 in Addis
    expect(clinicDateKey('2026-11-09T21:00:00Z')).toBe('2026-11-10'); // 00:00 next day in Addis
  });
  it('reads wall-clock hour and formats 24h time', () => {
    expect(clinicHour('2026-11-10T05:30:00Z')).toBe(8);
    expect(formatClinicTime('2026-11-10T05:30:00Z')).toBe('08:30');
    expect(formatClinicTime('2026-11-10T14:15:00+00:00')).toBe('17:15');
  });
  it('formats a date key without shifting the day', () => {
    expect(formatClinicDate('2026-11-10')).toBe('Tuesday, 10 November 2026');
    expect(formatClinicDate('2026-11-10', 'en-GB', false)).toBe('Tuesday 10 November');
  });
  it('has no DST jump across the year', () => {
    expect(clinicHour('2026-01-15T06:00:00Z')).toBe(9);
    expect(clinicHour('2026-07-15T06:00:00Z')).toBe(9);
  });
});

describe('calendar arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-11-10', -10)).toBe('2026-10-31');
  });
  it('weekday matches Postgres extract(dow) (0 = Sunday)', () => {
    expect(weekdayOfKey('2026-11-08')).toBe(0);
    expect(weekdayOfKey('2026-11-09')).toBe(1);
    expect(weekdayOfKey('2026-11-14')).toBe(6);
  });
});

describe('groupSlots', () => {
  const rows = [
    { dentist_id: 'b', starts_at: '2026-11-10T06:00:00+00:00', ends_at: '2026-11-10T06:45:00+00:00' },
    { dentist_id: 'a', starts_at: '2026-11-10T05:30:00+00:00', ends_at: '2026-11-10T06:15:00+00:00' },
    { dentist_id: 'a', starts_at: '2026-11-10T06:00:00Z', ends_at: '2026-11-10T06:45:00Z' },
    { dentist_id: 'a', starts_at: '2026-11-10T06:00:00Z', ends_at: '2026-11-10T06:45:00Z' }, // duplicate row
    { dentist_id: 'c', starts_at: 'not-a-date', ends_at: 'x' },
  ];
  it('dedupes by start time across formats, sorts, and lists free dentists', () => {
    expect(groupSlots(rows)).toEqual([
      { startsAt: '2026-11-10T05:30:00.000Z', endsAt: '2026-11-10T06:15:00.000Z', dentistIds: ['a'] },
      { startsAt: '2026-11-10T06:00:00.000Z', endsAt: '2026-11-10T06:45:00.000Z', dentistIds: ['b', 'a'] },
    ]);
  });
  it('returns [] for no rows', () => {
    expect(groupSlots([])).toEqual([]);
  });
  it('splits by clinic part of day', () => {
    const opts = groupSlots([
      { dentist_id: 'a', starts_at: '2026-11-10T05:30:00Z', ends_at: '2026-11-10T06:15:00Z' }, // 08:30
      { dentist_id: 'a', starts_at: '2026-11-10T08:45:00Z', ends_at: '2026-11-10T09:30:00Z' }, // 11:45
      { dentist_id: 'a', starts_at: '2026-11-10T10:30:00Z', ends_at: '2026-11-10T11:15:00Z' }, // 13:30
      { dentist_id: 'a', starts_at: '2026-11-10T14:00:00Z', ends_at: '2026-11-10T14:45:00Z' }, // 17:00
    ]);
    const split = splitByPartOfDay(opts);
    expect(split.morning.map((o) => formatClinicTime(o.startsAt))).toEqual(['08:30', '11:45']);
    expect(split.afternoon.map((o) => formatClinicTime(o.startsAt))).toEqual(['13:30']);
    expect(split.evening.map((o) => formatClinicTime(o.startsAt))).toEqual(['17:00']);
    expect(partOfDay('2026-11-10T09:00:00Z')).toBe('afternoon'); // 12:00 local
  });
});

describe('clinic wall-clock → instant', async () => {
  const { clinicIso, clinicDayRange, minutesBetween } = await import('@shared/time.ts');
  it('converts Addis wall-clock to UTC', () => {
    expect(clinicIso('2026-11-10', '08:30')).toBe('2026-11-10T05:30:00.000Z');
    expect(clinicIso('2026-11-10', '00:00')).toBe('2026-11-09T21:00:00.000Z');
    expect(clinicIso('2026-11-10', '14:15:00')).toBe('2026-11-10T11:15:00.000Z');
  });
  it('day range spans exactly 24h of clinic time', () => {
    const r = clinicDayRange('2026-12-31');
    expect(r).toEqual({ from: '2026-12-30T21:00:00.000Z', to: '2026-12-31T21:00:00.000Z' });
    expect(minutesBetween(r.from, r.to)).toBe(1440);
  });
});

describe('Ethiopian local time and calendar', async () => {
  const { ethiopianTime, ethiopianTimeOfDay, toEthiopianDate, formatEthiopianDate } = await import('@shared/time.ts');
  it('converts clinic time to the local 12-hour clock', () => {
    expect(ethiopianTimeOfDay('08:30')).toBe('2:30 ጠዋት');
    expect(ethiopianTimeOfDay('06:00')).toBe('12:00 ጠዋት');
    expect(ethiopianTimeOfDay('12:00')).toBe('6:00 ከሰዓት');
    expect(ethiopianTimeOfDay('14:15')).toBe('8:15 ከሰዓት');
    expect(ethiopianTimeOfDay('18:00')).toBe('12:00 ምሽት');
    expect(ethiopianTimeOfDay('23:45', 'en')).toBe('5:45 evening');
    expect(ethiopianTimeOfDay('03:00', 'en')).toBe('9:00 night');
    expect(ethiopianTime('2026-11-10T05:30:00Z')).toBe('2:30 ጠዋት'); // 08:30 in Addis
  });
  it('converts Gregorian to Ethiopian dates', () => {
    expect(toEthiopianDate('2026-09-11')).toEqual({ year: 2019, month: 1, day: 1 }); // Enkutatash
    expect(toEthiopianDate('2023-09-12')).toEqual({ year: 2016, month: 1, day: 1 }); // after a Gregorian leap year
    expect(toEthiopianDate('2026-01-07')).toEqual({ year: 2018, month: 4, day: 29 }); // Genna
    expect(toEthiopianDate('2026-01-19')).toEqual({ year: 2018, month: 5, day: 11 }); // Timket
    expect(toEthiopianDate('2026-09-06')).toEqual({ year: 2018, month: 13, day: 1 }); // Pagume 1
    expect(formatEthiopianDate('2026-11-06')).toBe('ጥቅምት 27, 2019');
    expect(formatEthiopianDate('2026-11-06', 'en', false)).toBe('Tikimt 27');
  });
});
