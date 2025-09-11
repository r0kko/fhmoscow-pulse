import { beforeAll, expect, test } from '@jest/globals';

beforeAll(() => {
  process.env.VERIFY_HMAC_SECRET = 'test-secret';
  process.env.BASE_URL = 'https://lk.fhmoscow.com';
});

test('builds and verifies token for given ids', async () => {
  const { buildVerifyToken, verifyToken } = await import(
    '../src/utils/verifyDocHmac.js'
  );
  const token = buildVerifyToken({ d: 'doc-1', s: 'sign-1', u: 'user-1' });
  expect(typeof token).toBe('string');
  const { ok, payload } = verifyToken(token);
  expect(ok).toBe(true);
  expect(payload).toMatchObject({ d: 'doc-1', s: 'sign-1', u: 'user-1', v: 1 });
});

test('rejects tampered token', async () => {
  const { buildVerifyToken, verifyToken } = await import(
    '../src/utils/verifyDocHmac.js'
  );
  const good = buildVerifyToken({ d: 'd', s: 's', u: 'u' });
  const [body] = good.split('.');
  const bad = `${body}.AAAAAAAA`;
  const { ok } = verifyToken(bad);
  expect(ok).toBe(false);
});

test('builds public verify URL', async () => {
  const { buildVerifyUrl, verifyToken } = await import(
    '../src/utils/verifyDocHmac.js'
  );
  const url = buildVerifyUrl({ d: 'D', s: 'S', u: 'U' });
  expect(url.startsWith('https://lk.fhmoscow.com/verify?t=')).toBe(true);
  const t = decodeURIComponent(url.split('t=')[1] || '');
  const { ok, payload } = verifyToken(t);
  expect(ok).toBe(true);
  expect(payload).toMatchObject({ d: 'D', s: 'S', u: 'U' });
});
