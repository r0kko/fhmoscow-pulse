import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@jest/globals';

import { loadTsModule } from './utils/loadTsModule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { withHttp } = loadTsModule(
  path.resolve(__dirname, '../client/src/utils/url.ts')
);

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
