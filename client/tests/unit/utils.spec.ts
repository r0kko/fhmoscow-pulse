import { describe, expect, it, vi } from 'vitest';

import { isValidAccountNumber } from '@/utils/bank';
import { loadPageSize, savePageSize } from '@/utils/pageSize';
import { evaluatePassword } from '@/utils/passwordPolicy';
import {
  formatRussianPhone,
  formatSnils,
  isValidInn,
  isValidSnils,
  normalizeRussianPhone,
} from '@/utils/personal';
import { pluralize } from '@/utils/plural';
import {
  ADMIN_ROLES,
  hasRole,
  isBrigadeRefereeOnly,
  isStaffOnly,
} from '@/utils/roles';
import {
  formatStaffPositionList,
  getStaffPositionLabel,
} from '@/utils/staffAccess';
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
} from '@/utils/time';
import { typeBadgeClass } from '@/utils/training';
import { withHttp } from '@/utils/url';
import {
  endAfterStart,
  nonNegativeNumber,
  required,
  validateDateRange,
} from '@/utils/validation';

const validInn = '500100732259';
const invalidInn = '123456789012';

const validSnils = '11223344595';
const invalidSnils = '12345678901';
const snilsSum100 = '00102889900';
const snilsSum101 = '00102898900';
const snilsMod100 = '00299998900';

describe('utils/pageSize', () => {
  it('loads stored page size or falls back to default', () => {
    localStorage.setItem('table', '50');
    expect(loadPageSize('table', 20)).toBe(50);
    localStorage.setItem('table', 'abc');
    expect(loadPageSize('table', 20)).toBe(20);
    localStorage.setItem('table', '-5');
    expect(loadPageSize('table', 20)).toBe(20);
    localStorage.setItem('table', '0');
    expect(loadPageSize('table', 20)).toBe(20);
    localStorage.removeItem('table');
    expect(loadPageSize('table', 15)).toBe(15);
  });

  it('persists page size when storage is available', () => {
    localStorage.clear();
    savePageSize('listing', 25);
    expect(localStorage.getItem('listing')).toBe('25');
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
    expect(isValidAccountNumber('40702810900000000000', '04452522')).toBe(
      false
    );
    expect(isValidAccountNumber('notanaccount', '044525225')).toBe(false);
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

  it('penalizes sequential and repeating inputs', () => {
    const sequential = evaluatePassword('abcdef');
    expect(sequential.checks.notSequential).toBe(false);
    expect(sequential.ok).toBe(false);

    const repeating = evaluatePassword('11111111');
    expect(repeating.checks.notRepeating).toBe(false);
    expect(repeating.ok).toBe(false);
  });
});

describe('utils/personal', () => {
  it('validates INN control digits', () => {
    expect(isValidInn(validInn)).toBe(true);
    expect(isValidInn(invalidInn)).toBe(false);
    expect(isValidInn('123')).toBe(false);
  });

  it('validates and formats SNILS numbers', () => {
    expect(isValidSnils(validSnils)).toBe(true);
    expect(isValidSnils(invalidSnils)).toBe(false);
    expect(isValidSnils('123')).toBe(false);
    expect(formatSnils(validSnils)).toBe('112-233-445 95');
  });

  it('supports edge-case SNILS values and partial formatting', () => {
    expect(isValidSnils('00000000004')).toBe(true); // below checksum threshold
    expect(formatSnils('123')).toBe('123-');
    expect(formatSnils('12345')).toBe('123-45');
  });

  it('passes SNILS checksum boundary scenarios', () => {
    expect(isValidSnils(snilsSum100)).toBe(true);
    expect(isValidSnils(snilsSum101)).toBe(true);
    expect(isValidSnils(snilsMod100)).toBe(true);
  });
});

describe('utils/personal phone helpers', () => {
  it('normalizes arbitrary input to Russian phone digits', () => {
    expect(normalizeRussianPhone('+7 (999) 111-22-33')).toBe('79991112233');
    expect(normalizeRussianPhone('8 999 111-22-33')).toBe('79991112233');
    expect(normalizeRussianPhone('')).toBe('');
  });

  it('formats Russian phone digits for display', () => {
    expect(formatRussianPhone('79991112233')).toBe('+7 (999) 111-22-33');
    expect(formatRussianPhone('7')).toBe('+7');
    expect(formatRussianPhone(null)).toBe('');
  });
});

describe('utils/plural', () => {
  it('returns correct plural form for Russian rules', () => {
    const forms: [string, string, string] = ['минута', 'минуты', 'минут'];
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
    expect(hasRole(undefined, ADMIN_ROLES)).toBe(false);
    expect(hasRole(null, ADMIN_ROLES)).toBe(false);
  });

  it('identifies brigade referees and staff compositions', () => {
    expect(isBrigadeRefereeOnly(['BRIGADE_REFEREE'])).toBe(true);
    expect(isBrigadeRefereeOnly(['BRIGADE_REFEREE', 'REFEREE'])).toBe(false);
    expect(isBrigadeRefereeOnly(undefined)).toBe(false);
    expect(isBrigadeRefereeOnly(null)).toBe(false);
    expect(isStaffOnly(['SPORT_SCHOOL_STAFF'])).toBe(true);
    expect(isStaffOnly(['SPORT_SCHOOL_STAFF', 'ADMIN'])).toBe(false);
    expect(isStaffOnly(['ADMIN'])).toBe(false);
    expect(isStaffOnly(undefined)).toBe(false);
    expect(isStaffOnly([])).toBe(false);
  });
});

describe('utils/staffAccess', () => {
  it('maps role aliases to localized labels', () => {
    expect(getStaffPositionLabel('coach')).toBe('Тренер');
    expect(getStaffPositionLabel('media_manager')).toBe('Медиа-менеджер');
    expect(getStaffPositionLabel(undefined)).toBe('');
    expect(getStaffPositionLabel('unknown')).toBe('');
  });

  it('deduplicates and formats staff role lists', () => {
    expect(
      formatStaffPositionList([
        'coach',
        'COACH',
        'accountant',
        null,
        'media_manager',
      ])
    ).toBe('Тренер, Бухгалтер и Медиа-менеджер');
    expect(formatStaffPositionList([])).toBe('');
    expect(formatStaffPositionList(['unknown'])).toBe('');
    expect(formatStaffPositionList(['coach'])).toBe('Тренер');
    expect(formatStaffPositionList(undefined)).toBe('');
  });
});

describe('utils/time', () => {
  const iso = '2024-05-01T18:30:00+03:00';

  it('formats and parses minute-second strings', () => {
    expect(formatMinutesSeconds(125)).toBe('02:05');
    expect(formatMinutesSeconds(null)).toBe('');
    expect(formatMinutesSeconds('abc')).toBe('');
    expect(parseMinutesSeconds('02:05')).toBe(125);
    expect(parseMinutesSeconds('205')).toBe(125);
    expect(parseMinutesSeconds('invalid')).toBeNull();
    expect(parseMinutesSeconds(null)).toBeNull();
    expect(parseMinutesSeconds('04:75')).toBeNull();
  });

  it('normalizes Moscow-local dates and times', () => {
    expect(toDayKey(iso)).toBe(Date.UTC(2024, 4, 1));
    expect(toDateTimeLocal(iso)).toBe('2024-05-01T18:30');
    expect(fromDateTimeLocal('2024-05-01T18:30')).toBe(
      '2024-05-01T15:30:00.000Z'
    );
    expect(toDayKey(null)).toBeNull();
    expect(toDayKey('not-a-date')).toBeNull();
    expect(toDateTimeLocal(null)).toBe('');
    expect(toDateTimeLocal('bad-date')).toBe('');
    expect(fromDateTimeLocal('')).toBe('');
  });

  it('handles malformed locale representations when computing day keys', () => {
    const dateSpy = vi
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValueOnce('2024/05/01')
      .mockReturnValueOnce('2024-xx-yy');

    expect(toDayKey(iso)).toBeNull();
    expect(toDayKey(iso)).toBeNull();

    dateSpy.mockRestore();
  });

  it('detects midnight and formats UI-friendly values', () => {
    expect(isMskMidnight('2024-05-01T00:00:00+03:00')).toBe(true);
    expect(isMskMidnight('2024-05-01T01:00:00+03:00')).toBe(false);
    expect(isMskMidnight('not-a-date')).toBe(false);
    expect(isMskMidnight('2024-05-01T00:00:00+03:00', 'Invalid/Zone')).toBe(
      false
    );
    expect(isMskMidnight(null)).toBe(false);
    expect(formatMskTimeShort('2024-05-01T00:00:00+03:00')).toBe('—:—');
    expect(formatMskTimeShort(iso)).toBe('18:30');
    expect(formatMskTimeShort('not-a-date', { placeholder: '??' })).toBe('??');
    expect(formatMskDateLong(iso)).toMatch(/1 мая/i);
    expect(formatMskDateLong('bad-date')).toBe('');
    expect(formatKickoff(iso)).toMatchObject({ time: '18:30' });
    expect(formatKickoff(null)).toMatchObject({ time: '—:—', date: '' });
  });

  it('gracefully handles serialization errors when building ISO strings', () => {
    const spy = vi
      .spyOn(Date.prototype, 'toISOString')
      .mockImplementation(() => {
        throw new Error('range');
      });

    expect(fromDateTimeLocal('2024-05-01T18:30')).toBe('');

    spy.mockRestore();
  });

  it('returns empty output when date parts are missing after formatting', () => {
    const formatterSpy = vi
      .spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
      .mockReturnValueOnce([{ type: 'year', value: '2024' }])
      .mockReturnValueOnce([{ type: 'minute', value: '07' }])
      .mockReturnValueOnce([{ type: 'hour', value: '05' }]);

    expect(toDateTimeLocal(iso)).toBe('');
    expect(formatMskTimeShort(iso, { placeholder: '--' })).toBe('00:07');
    expect(formatMskTimeShort(iso, { placeholder: '--' })).toBe('05:00');

    formatterSpy.mockRestore();
  });

  it('returns empty date strings when localization yields empty output', () => {
    const dateSpy = vi
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValue('');

    expect(formatMskDateLong(iso)).toBe('');

    dateSpy.mockRestore();
  });
});

describe('utils/training', () => {
  it('maps training aliases to badge classes', () => {
    expect(typeBadgeClass('ICE')).toBe('bg-brand');
    expect(typeBadgeClass('BASIC_FIT')).toBe('bg-success');
    expect(typeBadgeClass('UNKNOWN')).toBe('bg-secondary');
    expect(typeBadgeClass(undefined)).toBe('bg-secondary');
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
    expect(nonNegativeNumber('')).toBe(true);
    expect(nonNegativeNumber(null)).toBe(true);
    expect(nonNegativeNumber(undefined)).toBe(true);
  });

  it('validates chronological order of date ranges', () => {
    expect(endAfterStart('2024-05-01T10:00', '2024-05-01T11:00')).toBe(true);
    expect(endAfterStart('2024-05-01T11:00', '2024-05-01T10:00')).toBe(false);
    expect(endAfterStart('invalid', '2024-05-01T10:00')).toBe(false);
    expect(endAfterStart('', '2024-05-01T10:00')).toBe(true);
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
