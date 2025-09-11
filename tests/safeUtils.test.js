import { describe, expect, test } from '@jest/globals';
import {
  coalesce,
  tryParseInt,
  ensureArray,
  isEmpty,
  clamp,
  pick,
  uniq,
} from '../src/utils/safe.js';

describe('safe utils', () => {
  test('coalesce returns fallback for null/undefined', () => {
    expect(coalesce(null, 'x')).toBe('x');
    expect(coalesce(undefined, 42)).toBe(42);
    expect(coalesce(0, 1)).toBe(0);
  });

  test('tryParseInt parses numbers or returns default', () => {
    expect(tryParseInt('10')).toBe(10);
    expect(tryParseInt('not-a-number', -1)).toBe(-1);
  });

  test('ensureArray wraps non-arrays and preserves arrays', () => {
    expect(ensureArray(null)).toEqual([]);
    expect(ensureArray([1, 2])).toEqual([1, 2]);
    expect(ensureArray('a')).toEqual(['a']);
  });

  test('isEmpty detects empty values', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty('')).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty({})).toBe(true);
    expect(isEmpty('x')).toBe(false);
  });

  test('clamp restricts values and handles non-numbers', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp('x', 1, 3)).toBe(1);
  });

  test('pick selects only requested keys; uniq removes duplicates', () => {
    expect(pick({ a: 1, b: 2 }, ['b'])).toEqual({ b: 2 });
    expect(uniq([1, 1, 2, 3, 3])).toEqual([1, 2, 3]);
  });
});
