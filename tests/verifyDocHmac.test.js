import { beforeAll, expect, test } from '@jest/globals';

beforeAll(() => {
  process.env.VERIFY_HMAC_SECRET = 'test-secret';
  process.env.BASE_URL = 'https://lk.fhmoscow.com';
  process.env.VERIFY_TOKEN_TTL_DAYS = '365';
  process.env.VERIFY_HASH_URL_ENABLED = 'true';
});

test('builds and verifies token for given ids', async () => {
  const { buildVerifyToken, verifyToken } =
    await import('../src/utils/verifyDocHmac.js');
  const token = buildVerifyToken({ d: 'doc-1', s: 'sign-1', u: 'user-1' });
  expect(typeof token).toBe('string');
  const { ok, payload, version } = verifyToken(token);
  expect(ok).toBe(true);
  expect(version).toBe(2);
  expect(payload).toMatchObject({
    d: 'doc-1',
    s: 'sign-1',
    u: 'user-1',
    v: 2,
    iat: expect.any(Number),
    exp: expect.any(Number),
  });
  expect(payload.exp).toBeGreaterThan(payload.iat);
});

test('rejects tampered token', async () => {
  const { buildVerifyToken, verifyToken } =
    await import('../src/utils/verifyDocHmac.js');
  const good = buildVerifyToken({ d: 'd', s: 's', u: 'u' });
  const [body] = good.split('.');
  const bad = `${body}.AAAAAAAA`;
  const { ok } = verifyToken(bad);
  expect(ok).toBe(false);
});

test('rejects malformed token with extra separators', async () => {
  const { buildVerifyToken, verifyToken } =
    await import('../src/utils/verifyDocHmac.js');
  const good = buildVerifyToken({ d: 'd', s: 's', u: 'u' });
  const malformed = `${good}.tail`;
  const { ok, error } = verifyToken(malformed);
  expect(ok).toBe(false);
  expect(error).toBe('invalid');
});

test('rejects expired token', async () => {
  const { buildVerifyToken, verifyToken } =
    await import('../src/utils/verifyDocHmac.js');
  const token = buildVerifyToken(
    { d: 'd', s: 's', u: 'u' },
    { issuedAt: '2024-01-01T00:00:00.000Z', ttlDays: 1 }
  );
  const { ok, error } = verifyToken(token, {
    nowMs: Date.parse('2024-01-03T00:00:00.000Z'),
  });
  expect(ok).toBe(false);
  expect(error).toBe('expired');
});

test('builds public verify URL', async () => {
  const { buildVerifyUrl, verifyToken } =
    await import('../src/utils/verifyDocHmac.js');
  const url = buildVerifyUrl({ d: 'D', s: 'S', u: 'U' });
  expect(url.startsWith('https://lk.fhmoscow.com/verify#t=')).toBe(true);
  const t = decodeURIComponent(url.split('#t=')[1] || '');
  const { ok, payload } = verifyToken(t);
  expect(ok).toBe(true);
  expect(payload).toMatchObject({ d: 'D', s: 'S', u: 'U' });
});
