import { afterEach, describe, expect, jest, test } from '@jest/globals';

const managedEnvKeys = [
  'VERIFY_HMAC_SECRET',
  'BASE_URL',
  'SHORTLINK_ENABLED',
  'SHORTLINK_BACKEND',
  'SHORTLINK_PUBLIC_PREFIX',
  'SHORTLINK_CODE_LENGTH',
  'SHORTLINK_TTL_DAYS',
];

const originalValues = managedEnvKeys.reduce((acc, key) => {
  acc[key] = process.env[key];
  return acc;
}, {});

const shortLinkModelModuleId = new URL(
  '../src/models/shortLink.js',
  import.meta.url
).href;
const loggerModuleId = new URL('../logger.js', import.meta.url).href;

afterEach(() => {
  managedEnvKeys.forEach((key) => {
    if (originalValues[key] === undefined) delete process.env[key];
    else process.env[key] = originalValues[key];
  });
  jest.resetModules();
});

describe('shortLinkService memory backend', () => {
  test('buildShortVerifyUrl generates compact URL and resolver returns token', async () => {
    await jest.isolateModulesAsync(async () => {
      process.env.VERIFY_HMAC_SECRET = 'test-secret';
      process.env.BASE_URL = 'https://lk.fhmoscow.com';
      process.env.SHORTLINK_ENABLED = 'true';
      process.env.SHORTLINK_BACKEND = 'memory';
      process.env.SHORTLINK_PUBLIC_PREFIX = '/api/v';

      const { buildShortVerifyUrl, resolveCode } = await import(
        '../src/services/shortLinkService.js'
      );

      const url = await buildShortVerifyUrl({ d: 'docX', s: 'signY', u: 'userZ' });
      expect(url.startsWith('https://lk.fhmoscow.com/api/v/')).toBe(true);
      const code = url.split('/').pop();
      const token = await resolveCode(code);
      expect(typeof token).toBe('string');

      const { verifyToken } = await import('../src/utils/verifyDocHmac.js');
      const { ok, payload } = verifyToken(token);
      expect(ok).toBe(true);
      expect(payload).toMatchObject({ d: 'docX', s: 'signY', u: 'userZ' });
    });
  });
});

describe('shortLinkService db backend', () => {
  test('reuses existing record and increments hits on resolve', async () => {
    const findOneMock = jest.fn().mockResolvedValue({
      code: 'dbCode',
      expires_at: new Date(Date.now() + 60_000),
    });
    const createMock = jest.fn();
    const saveMock = jest.fn().mockResolvedValue();
    const findByPkMock = jest.fn().mockResolvedValue({
      token: 'db-token',
      expires_at: new Date(Date.now() + 60_000),
      hits: 0,
      save: saveMock,
    });

    await jest.isolateModulesAsync(async () => {
      process.env.VERIFY_HMAC_SECRET = 'db-secret';
      process.env.BASE_URL = 'https://lk.fhmoscow.com';
      process.env.SHORTLINK_ENABLED = 'true';
      process.env.SHORTLINK_BACKEND = 'db';
      process.env.SHORTLINK_PUBLIC_PREFIX = '/short';
      process.env.SHORTLINK_CODE_LENGTH = '10';
      process.env.SHORTLINK_TTL_DAYS = '30';

      jest.unstable_mockModule(shortLinkModelModuleId, () => ({
        __esModule: true,
        default: {
          findOne: findOneMock,
          create: createMock,
          findByPk: findByPkMock,
          sequelize: { Op: { lt: Symbol('lt') } },
        },
      }));

      jest.unstable_mockModule(loggerModuleId, () => ({
        __esModule: true,
        default: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
      }));

      const { getOrCreateForToken, resolveCode } = await import(
        '../src/services/shortLinkService.js'
      );

      const code = await getOrCreateForToken('db-token');
      expect(code).toBe('dbCode');
      expect(createMock).not.toHaveBeenCalled();

      const resolved = await resolveCode('any-code');
      expect(findByPkMock).toHaveBeenCalledWith('any-code');
      expect(saveMock).toHaveBeenCalled();
      expect(resolved).toBe('db-token');
    });
  });

  test('falls back to memory backend when table missing', async () => {
    const missingTableError = new Error('relation "short_links" does not exist');
    const findOneMock = jest.fn().mockRejectedValue(missingTableError);

    await jest.isolateModulesAsync(async () => {
      process.env.VERIFY_HMAC_SECRET = 'fallback-secret';
      process.env.BASE_URL = 'https://lk.fhmoscow.com';
      process.env.SHORTLINK_ENABLED = 'true';
      process.env.SHORTLINK_BACKEND = 'db';
      process.env.SHORTLINK_PUBLIC_PREFIX = '/v';

      const warnMock = jest.fn();

      jest.unstable_mockModule(shortLinkModelModuleId, () => ({
        __esModule: true,
        default: {
          findOne: findOneMock,
          create: jest.fn(),
          findByPk: jest.fn(),
          sequelize: { Op: { lt: Symbol('lt') } },
        },
      }));

      jest.unstable_mockModule(loggerModuleId, () => ({
        __esModule: true,
        default: { warn: warnMock, info: jest.fn(), error: jest.fn() },
      }));

      const { getOrCreateForToken } = await import(
        '../src/services/shortLinkService.js'
      );

      const code = await getOrCreateForToken('fallback-token');
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThanOrEqual(6);
      expect(warnMock).toHaveBeenCalledWith(
        'ShortLink table missing; falling back to memory backend'
      );
      expect(process.env.SHORTLINK_BACKEND).toBe('memory');
    });
  });
});
