import { beforeAll, expect, test } from '@jest/globals';

beforeAll(() => {
  process.env.VERIFY_HMAC_SECRET = 'test-secret';
  process.env.BASE_URL = 'https://lk.fhmoscow.com';
  process.env.SHORTLINK_ENABLED = 'true';
  process.env.SHORTLINK_BACKEND = 'memory';
  process.env.SHORTLINK_PUBLIC_PREFIX = '/api/v';
});

test('buildShortVerifyUrl generates compact URL and resolver redirects', async () => {
  const { buildShortVerifyUrl, resolveCode } = await import(
    '../src/services/shortLinkService.js'
  );
  const url = await buildShortVerifyUrl({ d: 'docX', s: 'signY', u: 'userZ' });
  expect(url.startsWith('https://lk.fhmoscow.com/api/v/')).toBe(true);
  const code = url.split('/').pop();
  const token = await resolveCode(code);
  expect(typeof token).toBe('string');
  // Verify the token decodes correctly
  const { verifyToken } = await import('../src/utils/verifyDocHmac.js');
  const { ok, payload } = verifyToken(token);
  expect(ok).toBe(true);
  expect(payload).toMatchObject({ d: 'docX', s: 'signY', u: 'userZ' });
});
