import { expect, test } from '@jest/globals';
import { extractFirstUrl } from '../src/utils/url.js';

test('extractFirstUrl returns first http(s) url', () => {
  const s = 'see https://example.com and http://test.local next';
  expect(extractFirstUrl(s)).toBe('https://example.com');
});

test('extractFirstUrl returns null for empty or missing', () => {
  expect(extractFirstUrl('no urls here')).toBe(null);
  expect(extractFirstUrl('')).toBe(null);
  expect(extractFirstUrl(null)).toBe(null);
});
