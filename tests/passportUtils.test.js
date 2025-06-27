import { describe, test, expect } from '@jest/globals';
import {
  calculateValidUntil,
  sanitizePassportData,
} from '../src/utils/passportUtils.js';

describe('passport utils', () => {
  test('calculateValidUntil for age below 20', () => {
    expect(calculateValidUntil('1990-01-01', '2005-02-03')).toBe('2010-04-01');
  });

  test('calculateValidUntil for age below 45', () => {
    expect(calculateValidUntil('1990-01-01', '2010-02-03')).toBe('2035-04-01');
  });

  test('calculateValidUntil returns null for age 45+', () => {
    expect(calculateValidUntil('1950-01-01', '2020-01-01')).toBe(null);
  });

  test('sanitizePassportData normalizes dates', () => {
    const res = sanitizePassportData({
      issue_date: 'Tue Mar 17 2020 00:00:00 GMT+0000 (Coordinated Universal Time)',
      valid_until: 'Wed Mar 18 2026 00:00:00 GMT+0000 (Coordinated Universal Time)',
    });
    expect(res.issue_date).toBe('2020-03-17');
    expect(res.valid_until).toBe('2026-03-18');
  });
});
