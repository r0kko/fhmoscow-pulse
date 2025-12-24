import { expect, test } from '@jest/globals';
import { readBool, readNumber, readString } from '../src/utils/env.js';

test('readBool normalizes inputs and respects defaults', () => {
  expect(readBool('YES')).toBe(true);
  expect(readBool('0')).toBe(false);
  expect(readBool('unexpected', true)).toBe(true);
  expect(readBool('', true)).toBe(true);
});

test('readNumber returns finite numbers or fallback', () => {
  expect(readNumber('42', 0)).toBe(42);
  expect(readNumber(' 17.5 ', 0)).toBe(17.5);
  expect(readNumber('nan', 3)).toBe(3);
  expect(readNumber(undefined, 5)).toBe(5);
});

test('readString trims whitespace and defaults correctly', () => {
  expect(readString(' value ', 'x')).toBe('value');
  expect(readString('', 'fallback')).toBe('fallback');
  expect(readString(undefined, 'missing')).toBe('missing');
});
