import { expect, test } from '@jest/globals';

import { moscowToUtc, utcToMoscow, formatMinutesSeconds } from '../src/utils/time.js';

test('moscowToUtc returns null for falsy/invalid', () => {
  expect(moscowToUtc(null)).toBeNull();
  expect(moscowToUtc(undefined)).toBeNull();
  expect(moscowToUtc('not-a-date')).toBeNull();
});

test('utcToMoscow returns null for falsy/invalid', () => {
  expect(utcToMoscow(null)).toBeNull();
  expect(utcToMoscow('bad-date')).toBeNull();
});

test('moscowToUtc subtracts three hours', () => {
  // Interpret input as Moscow time expressed on a UTC timeline
  const mskWallClock = new Date('2025-01-01T12:00:00Z');
  const utc = moscowToUtc(mskWallClock);
  expect(utc.toISOString()).toBe('2025-01-01T09:00:00.000Z');
});

test('utcToMoscow adds three hours', () => {
  const utc = new Date('2025-01-01T09:00:00Z');
  const msk = utcToMoscow(utc);
  // toISOString prints in UTC; adding 3h yields 12:00Z equivalent to 15:00+03
  expect(msk.toISOString()).toBe('2025-01-01T12:00:00.000Z');
});

test('formatMinutesSeconds formats and rounds correctly', () => {
  expect(formatMinutesSeconds(NaN)).toBe('');
  expect(formatMinutesSeconds(Infinity)).toBe('');
  expect(formatMinutesSeconds(0)).toBe('0:00');
  expect(formatMinutesSeconds(75)).toBe('1:15');
  expect(formatMinutesSeconds(59.6)).toBe('1:00');
});
