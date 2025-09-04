import { expect, test } from '@jest/globals';

import {
  calculateValidUntil,
  sanitizePassportData,
} from '../src/utils/passportUtils.js';

test('calculateValidUntil accepts Date objects (non-string path)', () => {
  const birth = new Date(Date.UTC(1990, 0, 1));
  const issue = new Date(Date.UTC(2005, 1, 3));
  expect(calculateValidUntil(birth, issue)).toBe('2010-04-01');
});

test('sanitizePassportData trims/unifies fields and preserves invalid dates as strings', () => {
  const res = sanitizePassportData({
    series: ' 12 34 ',
    number: ' 5678 90 ',
    issue_date: ' not a date ',
    valid_until: ' 2026-13-01 ',
    issuing_authority: '  УФМС  ',
    issuing_authority_code: ' 77 01  ',
    place_of_birth: '  Moscow ',
  });
  expect(res.series).toBe('1234');
  expect(res.number).toBe('567890');
  expect(res.issue_date).toBe('not a date');
  expect(res.valid_until).toBe('2026-13-01');
  expect(res.issuing_authority).toBe('УФМС');
  expect(res.issuing_authority_code).toBe('7701');
  expect(res.place_of_birth).toBe('Moscow');
});
