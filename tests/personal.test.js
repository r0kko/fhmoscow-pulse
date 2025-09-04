import { describe, expect, test } from '@jest/globals';
import { isValidInn, isValidSnils } from '../src/utils/personal.js';

describe('personal utils', () => {
  test('isValidInn validates checksum', () => {
    expect(isValidInn('226526799843')).toBe(true);
    expect(isValidInn('226526799844')).toBe(false);
  });

  test('isValidSnils validates checksum', () => {
    expect(isValidSnils('689-169-232 65')).toBe(true);
    expect(isValidSnils('689-169-232 66')).toBe(false);
  });
});
test('isValidSnils early return for small number', () => {
  expect(isValidSnils('001-001-998 00')).toBe(true);
});

test('isValidSnils handles sum equal to 100', () => {
  expect(isValidSnils('100-018-999 00')).toBe(true);
});

test('isValidSnils handles modulo check equal to 100', () => {
  expect(isValidSnils('101-998-999 00')).toBe(true);
});
