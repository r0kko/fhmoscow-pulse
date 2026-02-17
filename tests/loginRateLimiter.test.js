import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

describe('loginRateLimiter middleware', () => {
  let incRateLimitedMock;
  let incAuthLoginMock;
  let isRedisWritableMock;
  let RedisStoreMock;
  let rateLimitMock;

  const toBool = (val, defaultVal = false) => {
    if (val == null) return defaultVal;
    const s = String(val).toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.RATE_LIMIT_IP_SOURCE = 'req_ip';
    process.env.RATE_LIMIT_ENABLED = 'false';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret';

    incRateLimitedMock = jest.fn();
    incAuthLoginMock = jest.fn();
    isRedisWritableMock = jest.fn().mockReturnValue(true);
    RedisStoreMock = jest.fn(function RedisRateLimitStore(options) {
      this.options = options;
      this.init = jest.fn();
    });
    rateLimitMock = jest.fn((options) => {
      rateLimitMock.lastOptions = options;
      return (req, res, next) => {
        if (options.skip(req)) return next();
        return options.handler(req, res, next, options);
      };
    });
    rateLimitMock.ipKeyGenerator = (ip, prefix) => `${ip}/${prefix}`;

    jest.unstable_mockModule('express-rate-limit', () => ({
      __esModule: true,
      default: rateLimitMock,
      ipKeyGenerator: rateLimitMock.ipKeyGenerator,
    }));
    jest.unstable_mockModule('../src/config/metrics.js', () => ({
      __esModule: true,
      incRateLimited: incRateLimitedMock,
      incAuthLogin: incAuthLoginMock,
    }));
    jest.unstable_mockModule('../src/config/featureFlags.js', () => ({
      __esModule: true,
      isRateLimitEnabled: (kind = 'global') => {
        const isProd =
          String(process.env.NODE_ENV || '').toLowerCase() === 'production';
        const globalDefault = toBool(process.env.RATE_LIMIT_ENABLED, isProd);
        const envName = `RATE_LIMIT_${String(kind).toUpperCase()}_ENABLED`;
        if (Object.prototype.hasOwnProperty.call(process.env, envName)) {
          return toBool(process.env[envName], globalDefault);
        }
        return globalDefault;
      },
      isLockoutEnabled: () => false,
      isAuthLockoutErrorV2Enabled: () => false,
    }));
    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      isRedisWritable: isRedisWritableMock,
    }));
    jest.unstable_mockModule('../src/utils/api.js', () => ({
      __esModule: true,
      sendError: jest.fn(),
    }));
    jest.unstable_mockModule(
      '../src/middlewares/stores/redisRateLimitStore.js',
      () => ({
        __esModule: true,
        default: RedisStoreMock,
      })
    );
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test('is pass-through when disabled', async () => {
    process.env.RATE_LIMIT_LOGIN_ENABLED = 'false';

    const { default: middleware } =
      await import('../src/middlewares/loginRateLimiter.js');
    const { sendError } = await import('../src/utils/api.js');

    const next = jest.fn();
    await middleware(
      { method: 'POST', ip: '198.51.100.10', body: {} },
      {},
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(sendError).not.toHaveBeenCalled();
  });

  test('uses hashed account identifier in key and emits ip_rate_limited', async () => {
    process.env.RATE_LIMIT_LOGIN_ENABLED = 'true';
    process.env.RATE_LIMIT_USE_REDIS = 'true';

    const { default: middleware } =
      await import('../src/middlewares/loginRateLimiter.js');

    expect(RedisStoreMock).toHaveBeenCalledWith({ prefix: 'rate:login' });
    expect(typeof middleware).toBe('function');

    const req = {
      method: 'POST',
      ip: '198.51.100.10',
      body: { phone: '79990001122' },
    };
    const sendErrorMock = (await import('../src/utils/api.js')).sendError;
    const next = jest.fn();

    await middleware(req, {}, next);

    expect(incRateLimitedMock).toHaveBeenCalledWith('login');
    expect(incAuthLoginMock).toHaveBeenCalledWith('ip_rate_limited');
    expect(sendErrorMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        status: 429,
        code: 'rate_limited',
        retryAfter: expect.any(Number),
      })
    );

    const { keyGenerator } = rateLimitMock.lastOptions;
    const key = keyGenerator(req);
    expect(key).toMatch(/^ip:198\.51\.100\.10\/64\|acct:[a-f0-9]{64}$/);
    expect(key.includes('79990001122')).toBe(false);
  });
});
