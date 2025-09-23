import { describe, expect, test } from '@jest/globals';

import {
  formatStaffPositionList,
  getStaffPositionLabel,
} from '../client/src/utils/staffAccess.js';

describe('getStaffPositionLabel', () => {
  test('returns localized label for supported positions', () => {
    expect(getStaffPositionLabel('coach')).toBe('Тренер');
    expect(getStaffPositionLabel('ACCOUNTANT')).toBe('Бухгалтер');
    expect(getStaffPositionLabel('media_manager')).toBe('Медиа-менеджер');
  });

  test('returns empty string for unknown alias', () => {
    expect(getStaffPositionLabel('manager')).toBe('');
    expect(getStaffPositionLabel()).toBe('');
  });
});

describe('formatStaffPositionList', () => {
  test('returns empty string when no aliases provided', () => {
    expect(formatStaffPositionList()).toBe('');
    expect(formatStaffPositionList([])).toBe('');
  });

  test('deduplicates aliases and formats single value', () => {
    expect(formatStaffPositionList(['coach', 'COACH'])).toBe('Тренер');
  });

  test('formats multiple aliases with localized conjunction', () => {
    expect(formatStaffPositionList(['accountant', 'coach', 'ACCOUNTANT'])).toBe(
      'Бухгалтер и Тренер'
    );
    expect(
      formatStaffPositionList([
        'accountant',
        'media_manager',
        'coach',
        'MEDIA_MANAGER',
      ])
    ).toBe('Бухгалтер, Медиа-менеджер и Тренер');
  });
});
