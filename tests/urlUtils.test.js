import { expect, test } from '@jest/globals';

import { withHttp } from '../client/src/utils/url.js';

test('withHttp adds scheme when missing', () => {
  expect(withHttp('example.com')).toBe('http://example.com');
});

test('withHttp preserves existing http/https', () => {
  expect(withHttp('http://a.b')).toBe('http://a.b');
  expect(withHttp('https://a.b')).toBe('https://a.b');
});

test('withHttp returns falsy input as-is', () => {
  expect(withHttp('')).toBe('');
  expect(withHttp(null)).toBe(null);
  expect(withHttp(undefined)).toBe(undefined);
});

