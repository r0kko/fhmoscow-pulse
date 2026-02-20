import { afterEach, describe, expect, jest, test } from '@jest/globals';

const DOC_ID = 'bf3b5181-395c-439f-91d6-1df3f231c9ff';
const SIGN_ID = '431f6ac6-876c-4967-a066-2d1ec0436ac5';
const USER_ID = '9321ab79-5c0f-4817-9992-4b42ce5c8404';
const OTHER_USER_ID = '4d86be59-9a49-4ce8-b9dc-d208b2e0f355';

function createReq({ token = '', query = {} } = {}) {
  return {
    query,
    get: jest.fn((name) => {
      if (String(name).toLowerCase() === 'x-verify-token') return token;
      return '';
    }),
  };
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
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
  };
}

async function loadVerifyHandler({
  verifyTokenResult,
  doc,
  sign,
  now = Date.now(),
}) {
  jest.resetModules();
  jest.spyOn(Date, 'now').mockReturnValue(now);

  const verifyTokenMock = jest.fn(() => verifyTokenResult);
  const findDocMock = jest.fn(async () => doc);
  const findSignMock = jest.fn(async () => sign);

  jest.unstable_mockModule('../src/middlewares/verifyRateLimiter.js', () => ({
    __esModule: true,
    verifyRateLimiter: (_req, _res, next) => next(),
  }));
  jest.unstable_mockModule('../src/config/metrics.js', () => ({
    __esModule: true,
    incVerifyRequest: jest.fn(),
    observeVerifyRequestDuration: jest.fn(),
  }));
  jest.unstable_mockModule('../src/utils/verifyDocHmac.js', () => ({
    __esModule: true,
    verifyToken: verifyTokenMock,
  }));
  jest.unstable_mockModule('../src/models/index.js', () => ({
    __esModule: true,
    Document: { findByPk: findDocMock },
    DocumentStatus: {},
    DocumentUserSign: { findByPk: findSignMock },
    SignType: {},
    User: {},
  }));

  const router = (await import('../src/routes/verify.js')).default;
  const layer = router.stack.find((entry) => entry?.route?.path === '/');
  const routeStack = layer?.route?.stack || [];
  const handler = routeStack[routeStack.length - 1]?.handle;
  if (typeof handler !== 'function') {
    throw new Error('verify handler not found');
  }
  return { handler, verifyTokenMock, findDocMock, findSignMock };
}

describe('/verify route', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns public verification payload for valid token', async () => {
    const now = Date.parse('2026-02-20T12:00:00.000Z');
    const signedAt = new Date('2026-02-01T09:10:00.000Z');
    const { handler } = await loadVerifyHandler({
      now,
      verifyTokenResult: {
        ok: true,
        version: 2,
        payload: { d: DOC_ID, s: SIGN_ID, u: USER_ID },
      },
      doc: {
        id: DOC_ID,
        number: '25.02/123',
        name: 'Согласие',
        document_date: '2026-02-01T00:00:00.000Z',
        DocumentStatus: { alias: 'SIGNED', name: 'Подписан' },
      },
      sign: {
        id: SIGN_ID,
        document_id: DOC_ID,
        user_id: USER_ID,
        created_at: signedAt,
        User: { last_name: 'Иванов', first_name: 'Иван', patronymic: 'Иваныч' },
        SignType: {
          alias: 'SIMPLE_ELECTRONIC',
          name: 'Простая электронная подпись',
        },
      },
    });

    const req = createReq({ token: 'signed-token' });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      ok: true,
      result: 'valid',
      document: { number: '25.02/123', name: 'Согласие' },
      signer: { fio: 'Иванов Иван Иваныч' },
      signature: { typeAlias: 'SIMPLE_ELECTRONIC' },
    });
    expect(res.payload.document.id).toBeUndefined();
    expect(res.payload.signer.id).toBeUndefined();
    expect(res.payload.signature.id).toBeUndefined();
  });

  test('returns mismatch when signature references another user', async () => {
    const { handler } = await loadVerifyHandler({
      verifyTokenResult: {
        ok: true,
        version: 2,
        payload: { d: DOC_ID, s: SIGN_ID, u: USER_ID },
      },
      doc: {
        id: DOC_ID,
        number: 'N-1',
        name: 'Документ',
        document_date: '2026-02-01T00:00:00.000Z',
        DocumentStatus: { alias: 'SIGNED', name: 'Подписан' },
      },
      sign: {
        id: SIGN_ID,
        document_id: DOC_ID,
        user_id: OTHER_USER_ID,
        created_at: new Date(),
        User: null,
        SignType: null,
      },
    });

    const req = createReq({ token: 'signed-token' });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      ok: false,
      result: 'mismatch',
      error: 'mismatch',
    });
  });

  test('does not expire v2 token by legacy signing date ttl', async () => {
    const now = Date.parse('2026-02-20T12:00:00.000Z');
    const veryOld = new Date('2024-01-01T00:00:00.000Z');
    const { handler } = await loadVerifyHandler({
      now,
      verifyTokenResult: {
        ok: true,
        version: 2,
        payload: { d: DOC_ID, s: SIGN_ID, u: USER_ID },
      },
      doc: {
        id: DOC_ID,
        number: 'N-1',
        name: 'Документ',
        document_date: '2024-01-01T00:00:00.000Z',
        DocumentStatus: { alias: 'SIGNED', name: 'Подписан' },
      },
      sign: {
        id: SIGN_ID,
        document_id: DOC_ID,
        user_id: USER_ID,
        created_at: veryOld,
        User: { last_name: 'Тест', first_name: 'Тест', patronymic: null },
        SignType: {
          alias: 'SIMPLE_ELECTRONIC',
          name: 'Простая электронная подпись',
        },
      },
    });

    const req = createReq({ token: 'signed-token' });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      ok: true,
      result: 'valid',
    });
  });

  test('uses token iat when signing date from db is invalid epoch-like', async () => {
    const now = Date.parse('2026-02-20T12:00:00.000Z');
    const tokenIat = Math.floor(Date.parse('2026-02-20T09:23:50.000Z') / 1000);
    const { handler } = await loadVerifyHandler({
      now,
      verifyTokenResult: {
        ok: true,
        version: 2,
        payload: { d: DOC_ID, s: SIGN_ID, u: USER_ID, iat: tokenIat },
      },
      doc: {
        id: DOC_ID,
        number: 'N-1',
        name: 'Документ',
        document_date: '2026-02-20T00:00:00.000Z',
        DocumentStatus: { alias: 'SIGNED', name: 'Подписан' },
      },
      sign: {
        id: SIGN_ID,
        document_id: DOC_ID,
        user_id: USER_ID,
        created_at: '1970-01-01T00:00:00.000Z',
        User: { last_name: 'Тест', first_name: 'Тест', patronymic: null },
        SignType: {
          alias: 'SIMPLE_ELECTRONIC',
          name: 'Простая электронная подпись',
        },
      },
    });

    const req = createReq({ token: 'signed-token' });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      ok: true,
      result: 'valid',
      signature: {
        signedAt: '2026-02-20T09:23:50.000Z',
      },
    });
    expect(res.payload.signature.signedAtMsk).not.toContain('1970');
  });

  test('returns expired when signing date is older than ttl', async () => {
    const now = Date.parse('2026-02-20T12:00:00.000Z');
    const veryOld = new Date('2024-01-01T00:00:00.000Z');
    const { handler } = await loadVerifyHandler({
      now,
      verifyTokenResult: {
        ok: true,
        version: 1,
        payload: { d: DOC_ID, s: SIGN_ID, u: USER_ID },
      },
      doc: {
        id: DOC_ID,
        number: 'N-1',
        name: 'Документ',
        document_date: '2024-01-01T00:00:00.000Z',
        DocumentStatus: { alias: 'SIGNED', name: 'Подписан' },
      },
      sign: {
        id: SIGN_ID,
        document_id: DOC_ID,
        user_id: USER_ID,
        created_at: veryOld,
        User: { last_name: 'Тест', first_name: 'Тест', patronymic: null },
        SignType: {
          alias: 'SIMPLE_ELECTRONIC',
          name: 'Простая электронная подпись',
        },
      },
    });

    const req = createReq({ token: 'signed-token' });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res.payload).toMatchObject({
      ok: false,
      result: 'expired',
      error: 'token_expired',
    });
  });

  test('returns invalid for broken token', async () => {
    const { handler } = await loadVerifyHandler({
      verifyTokenResult: { ok: false, error: 'invalid' },
      doc: null,
      sign: null,
    });

    const req = createReq({ token: 'broken' });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      ok: false,
      result: 'invalid',
      error: 'invalid_token',
    });
  });

  test('returns invalid for token payload with non-uuid ids', async () => {
    const { handler, findDocMock, findSignMock } = await loadVerifyHandler({
      verifyTokenResult: {
        ok: true,
        version: 2,
        payload: { d: '1', s: '2', u: '3' },
      },
      doc: {
        id: DOC_ID,
        DocumentStatus: { alias: 'SIGNED', name: 'Подписан' },
      },
      sign: {
        id: SIGN_ID,
        document_id: DOC_ID,
        user_id: USER_ID,
        created_at: new Date(),
      },
    });

    const req = createReq({ token: 'signed-token' });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      ok: false,
      result: 'invalid',
      error: 'invalid_token',
    });
    expect(findDocMock).not.toHaveBeenCalled();
    expect(findSignMock).not.toHaveBeenCalled();
  });
});
