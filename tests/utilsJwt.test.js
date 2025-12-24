import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const baseEnv = { ...process.env };

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  process.env = { ...baseEnv };
  jest.resetModules();
});

async function loadJwt(overrides = {}) {
  process.env = { ...baseEnv, ...overrides };
  jest.resetModules();
  return import('../src/utils/jwt.js');
}

describe('utils/jwt', () => {
  test('performs symmetric access/refresh round trips', async () => {
    const user = { id: '42', token_version: 1 };
    const {
      signAccessToken,
      signRefreshToken,
      verifyAccessToken,
      verifyRefreshToken,
    } = await loadJwt({ JWT_SECRET: 'secret', JWT_ALG: 'HS256' });
    const access = signAccessToken(user);
    expect(verifyAccessToken(access).sub).toBe(user.id);
    const refresh = signRefreshToken(user);
    const refreshPayload = verifyRefreshToken(refresh);
    expect(refreshPayload.sub).toBe(user.id);
    expect(refreshPayload.type).toBe('refresh');
  });

  test('requires symmetric secret to sign tokens', async () => {
    const { signAccessToken } = await loadJwt({
      JWT_SECRET: '',
      JWT_ALG: 'HS256',
    });
    expect(() => signAccessToken({ id: '1' })).toThrow('Missing JWT_SECRET');
  });

  test('requires private key for asymmetric algorithms', async () => {
    const { signAccessToken } = await loadJwt({
      JWT_ALG: 'RS256',
      JWT_SECRET: '',
      JWT_PRIVATE_KEY: '',
    });
    expect(() => signAccessToken({ id: '1' })).toThrow(
      'Missing JWT_PRIVATE_KEY'
    );
  });

  test('verifyAccessToken wraps verification errors into ServiceError', async () => {
    const { verifyAccessToken } = await loadJwt({
      JWT_SECRET: 'secret',
      JWT_ALG: 'HS256',
    });
    expect(() => verifyAccessToken('not-a-jwt')).toThrow(
      expect.objectContaining({ code: 'invalid_token', status: 401 })
    );
  });

  test('verifyRefreshToken enforces refresh token type', async () => {
    const { signAccessToken, verifyRefreshToken } = await loadJwt({
      JWT_SECRET: 'secret',
      JWT_ALG: 'HS256',
    });
    const access = signAccessToken({ id: '99', token_version: 0 });
    expect(() => verifyRefreshToken(access)).toThrow('invalid_token_type');
  });

  test('decodeJwt safely returns null on malformed input', async () => {
    const { decodeJwt } = await loadJwt({ JWT_SECRET: 'secret' });
    expect(decodeJwt('$$$')).toBeNull();
  });

  test('verifyRefreshToken normalizes any verification failure to ServiceError', async () => {
    const { verifyRefreshToken } = await loadJwt({
      JWT_SECRET: 'secret',
      JWT_ALG: 'HS256',
    });
    expect(() => verifyRefreshToken('bad')).toThrow(
      expect.objectContaining({ code: 'invalid_token', status: 401 })
    );
  });
});
