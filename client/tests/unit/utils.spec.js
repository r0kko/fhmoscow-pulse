import { describe, expect, it, vi } from 'vitest';

import { isValidAccountNumber } from '@/utils/bank.js';
import { loadPageSize, savePageSize } from '@/utils/pageSize.js';
import { evaluatePassword } from '@/utils/passwordPolicy.js';
import { formatSnils, isValidInn, isValidSnils } from '@/utils/personal.js';
import { pluralize } from '@/utils/plural.js';
import {
  ADMIN_ROLES,
  hasRole,
  isBrigadeRefereeOnly,
  isStaffOnly,
} from '@/utils/roles';
import {
  formatKickoff,
  formatMinutesSeconds,
  formatMskDateLong,
  formatMskTimeShort,
  fromDateTimeLocal,
  isMskMidnight,
  parseMinutesSeconds,
  toDateTimeLocal,
  toDayKey,
} from '@/utils/time.js';
import { typeBadgeClass } from '@/utils/training.js';
import { withHttp } from '@/utils/url.js';
import {
  endAfterStart,
  nonNegativeNumber,
  required,
  validateDateRange,
} from '@/utils/validation.js';

const validInn = '500100732259';
const invalidInn = '123456789012';

const validSnils = '11223344595';
const invalidSnils = '12345678901';

describe('utils/pageSize', () => {
  it('loads stored page size or falls back to default', () => {
    localStorage.setItem('table', '50');
    expect(loadPageSize('table', 20)).toBe(50);
    localStorage.setItem('table', 'abc');
    expect(loadPageSize('table', 20)).toBe(20);
  });

  it('handles storage write errors gracefully', () => {
    const setItemSpy = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });
    expect(() => savePageSize('t', 10)).not.toThrow();
    setItemSpy.mockRestore();
  });

  it('returns default when storage access fails', () => {
    const getItemSpy = vi
      .spyOn(localStorage, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    expect(loadPageSize('table', 25)).toBe(25);
    getItemSpy.mockRestore();
  });
});

describe('utils/bank', () => {
  it('validates Russian account numbers against BIC control sum', () => {
    expect(isValidAccountNumber('40702810900000000000', '044525225')).toBe(
      true
    );
    expect(isValidAccountNumber('40702810900000000001', '044525225')).toBe(
      false
    );
    expect(isValidAccountNumber('notanaccount', 'badbic')).toBe(false);
  });
});

describe('utils/passwordPolicy', () => {
  it('accepts strong passwords and rejects weak ones', () => {
    const strong = evaluatePassword('Sup3r$ecure!');
    expect(strong.ok).toBe(true);
    expect(strong.score).toBeGreaterThanOrEqual(4);

    const weak = evaluatePassword('password');
    expect(weak.ok).toBe(false);
    expect(weak.checks.notCommon).toBe(false);
  });
});

describe('utils/personal', () => {
  it('validates INN control digits', () => {
    expect(isValidInn(validInn)).toBe(true);
    expect(isValidInn(invalidInn)).toBe(false);
  });

  it('validates and formats SNILS numbers', () => {
    expect(isValidSnils(validSnils)).toBe(true);
    expect(isValidSnils(invalidSnils)).toBe(false);
    expect(formatSnils(validSnils)).toBe('112-233-445 95');
  });

  it('supports edge-case SNILS values and partial formatting', () => {
    expect(isValidSnils('00000000004')).toBe(true); // below checksum threshold
    expect(formatSnils('123')).toBe('123-');
    expect(formatSnils('12345')).toBe('123-45');
  });
});

describe('utils/plural', () => {
  it('returns correct plural form for Russian rules', () => {
    const forms = ['минута', 'минуты', 'минут'];
    expect(pluralize(1, forms)).toBe('минута');
    expect(pluralize(3, forms)).toBe('минуты');
    expect(pluralize(12, forms)).toBe('минут');
    expect(pluralize(25, forms)).toBe('минут');
  });
});

describe('utils/roles', () => {
  it('detects presence of roles correctly', () => {
    expect(hasRole(['ADMIN'], ADMIN_ROLES)).toBe(true);
    expect(hasRole(['USER'], ADMIN_ROLES)).toBe(false);
  });

  it('identifies brigade referees and staff compositions', () => {
    expect(isBrigadeRefereeOnly(['BRIGADE_REFEREE'])).toBe(true);
    expect(isBrigadeRefereeOnly(['BRIGADE_REFEREE', 'REFEREE'])).toBe(false);
    expect(isStaffOnly(['SPORT_SCHOOL_STAFF'])).toBe(true);
    expect(isStaffOnly(['SPORT_SCHOOL_STAFF', 'ADMIN'])).toBe(false);
    expect(isStaffOnly(['ADMIN'])).toBe(false);
    expect(isStaffOnly()).toBe(false);
  });
});

describe('utils/time', () => {
  const iso = '2024-05-01T18:30:00+03:00';

  it('formats and parses minute-second strings', () => {
    expect(formatMinutesSeconds(125)).toBe('02:05');
    expect(formatMinutesSeconds(null)).toBe('');
    expect(parseMinutesSeconds('02:05')).toBe(125);
    expect(parseMinutesSeconds('205')).toBe(125);
    expect(parseMinutesSeconds('invalid')).toBeNull();
    expect(parseMinutesSeconds('04:75')).toBeNull();
  });

  it('normalizes Moscow-local dates and times', () => {
    expect(toDayKey(iso)).toBe(Date.UTC(2024, 4, 1));
    expect(toDateTimeLocal(iso)).toBe('2024-05-01T18:30');
    expect(fromDateTimeLocal('2024-05-01T18:30')).toBe(
      '2024-05-01T15:30:00.000Z'
    );
    expect(toDayKey()).toBeNull();
    expect(toDateTimeLocal()).toBe('');
    expect(fromDateTimeLocal('')).toBe('');
  });

  it('detects midnight and formats UI-friendly values', () => {
    expect(isMskMidnight('2024-05-01T00:00:00+03:00')).toBe(true);
    expect(isMskMidnight('2024-05-01T01:00:00+03:00')).toBe(false);
    expect(isMskMidnight('not-a-date')).toBe(false);
    expect(isMskMidnight('2024-05-01T00:00:00+03:00', 'Invalid/Zone')).toBe(
      false
    );
    expect(formatMskTimeShort('2024-05-01T00:00:00+03:00')).toBe('—:—');
    expect(formatMskTimeShort(iso)).toBe('18:30');
    expect(formatMskTimeShort('not-a-date', { placeholder: '??' })).toBe('??');
    expect(formatMskDateLong(iso)).toMatch(/1 мая/i);
    expect(formatMskDateLong('bad-date')).toBe('');
    expect(formatKickoff(iso)).toMatchObject({ time: '18:30' });
  });
});

describe('utils/training', () => {
  it('maps training aliases to badge classes', () => {
    expect(typeBadgeClass('ICE')).toBe('bg-brand');
    expect(typeBadgeClass('BASIC_FIT')).toBe('bg-success');
    expect(typeBadgeClass('UNKNOWN')).toBe('bg-secondary');
    expect(typeBadgeClass()).toBe('bg-secondary');
  });
});

describe('utils/url', () => {
  it('preserves protocol or adds default http', () => {
    expect(withHttp('https://fhmoscow.com')).toBe('https://fhmoscow.com');
    expect(withHttp('lk.fhmoscow.com')).toBe('http://lk.fhmoscow.com');
  });
});

describe('utils/validation', () => {
  it('checks required and non-negative values', () => {
    expect(required('value')).toBe(true);
    expect(required('')).toBe(false);
    expect(nonNegativeNumber('5')).toBe(true);
    expect(nonNegativeNumber('-1')).toBe(false);
  });

  it('validates chronological order of date ranges', () => {
    expect(endAfterStart('2024-05-01T10:00', '2024-05-01T11:00')).toBe(true);
    expect(endAfterStart('2024-05-01T11:00', '2024-05-01T10:00')).toBe(false);
    expect(validateDateRange('', '2024-05-01T10:00')).toBe('start_required');
    expect(validateDateRange('2024-05-01T10:00', '')).toBe('end_required');
    expect(validateDateRange('2024-05-01T10:00', '2024-05-01T09:00')).toBe(
      'order_invalid'
    );
    expect(
      validateDateRange('2024-05-01T10:00', '2024-05-01T11:00')
    ).toBeNull();
  });
});
