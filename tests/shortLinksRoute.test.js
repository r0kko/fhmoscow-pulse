import { afterEach, describe, expect, jest, test } from '@jest/globals';

function createReq({ code = '', accept = 'text/html' } = {}) {
  return {
    params: { code },
    get: jest.fn((name) => {
      if (String(name).toLowerCase() === 'accept') return accept;
      return '';
    }),
  };
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    location: null,
    set: jest.fn(function set(name, value) {
      this.headers[name] = value;
      return this;
    }),
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(payload) {
      this.payload = payload;
      return this;
    }),
    redirect: jest.fn(function redirect(code, location) {
      this.statusCode = code;
      this.location = location;
      return this;
    }),
  };
}

async function loadHandler(resolveImpl) {
  jest.resetModules();
  jest.unstable_mockModule('../src/middlewares/verifyRateLimiter.js', () => ({
    __esModule: true,
    shortLinkRateLimiter: (_req, _res, next) => next(),
  }));
  jest.unstable_mockModule('../src/config/metrics.js', () => ({
    __esModule: true,
    incShortLinkResolve: jest.fn(),
  }));
  jest.unstable_mockModule('../src/services/shortLinkService.js', () => ({
    __esModule: true,
    resolveCode: jest.fn(resolveImpl),
  }));
  const router = (await import('../src/routes/shortLinks.js')).default;
  const layer = router.stack.find((entry) => entry?.route?.path === '/:code');
  const stack = layer?.route?.stack || [];
  const handler = stack[stack.length - 1]?.handle;
  if (typeof handler !== 'function')
    throw new Error('shortlink handler missing');
  return handler;
}

describe('/v/:code route', () => {
  const originalBase = process.env.BASE_URL;

  afterEach(() => {
    if (originalBase === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = originalBase;
  });

  test('redirects to hash-based verify url for valid code', async () => {
    process.env.BASE_URL = 'https://lk.fhmoscow.com';
    const handler = await loadHandler(async () => 'signed.token');
    const req = createReq({ code: 'abc12345' });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(302);
    expect(res.location).toBe('https://lk.fhmoscow.com/verify#t=signed.token');
  });

  test('redirects to reason page when code is invalid (html client)', async () => {
    process.env.BASE_URL = 'https://lk.fhmoscow.com';
    const handler = await loadHandler(async () => null);
    const req = createReq({ code: 'bad!', accept: 'text/html' });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(302);
    expect(res.location).toBe(
      'https://lk.fhmoscow.com/verify#reason=invalid_code'
    );
  });

  test('returns json for API clients on not found', async () => {
    process.env.BASE_URL = 'https://lk.fhmoscow.com';
    const handler = await loadHandler(async () => null);
    const req = createReq({ code: 'abc12345', accept: 'application/json' });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload).toEqual({ error: 'not_found' });
  });
});
