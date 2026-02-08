import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

describe('passwordResetRateLimiters middleware', () => {
  let incRateLimitedMock;
  let sendErrorMock;
  let isRedisWritableMock;
  let RedisStoreMock;
  let rateLimitMock;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret';

    incRateLimitedMock = jest.fn();
    sendErrorMock = jest.fn();
    isRedisWritableMock = jest.fn().mockReturnValue(true);
    RedisStoreMock = jest.fn(function RedisRateLimitStore(options) {
      this.options = options;
      this.init = jest.fn();
    });

    rateLimitMock = jest.fn((options) => {
      rateLimitMock.calls = rateLimitMock.calls || [];
      rateLimitMock.calls.push(options);
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
    }));
    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      isRedisWritable: isRedisWritableMock,
    }));
    jest.unstable_mockModule('../src/utils/api.js', () => ({
      __esModule: true,
      sendError: sendErrorMock,
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

  test('returns pass-through middlewares when disabled', async () => {
    process.env.RATE_LIMIT_PASSWORD_RESET_ENABLED = 'false';

    const {
      passwordResetStartEmailRateLimiter,
      passwordResetStartIpRateLimiter,
      passwordResetFinishRateLimiter,
    } = await import('../src/middlewares/passwordResetRateLimiters.js');

    const next = jest.fn();
    await passwordResetStartEmailRateLimiter({ method: 'POST' }, {}, next);
    await passwordResetStartIpRateLimiter({ method: 'POST' }, {}, next);
    await passwordResetFinishRateLimiter({ method: 'POST' }, {}, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(sendErrorMock).not.toHaveBeenCalled();
  });

  test('applies configured limits and hashes email in keys', async () => {
    process.env.RATE_LIMIT_PASSWORD_RESET_ENABLED = 'true';
    process.env.RATE_LIMIT_USE_REDIS = 'true';

    const {
      passwordResetStartEmailRateLimiter,
      passwordResetStartIpRateLimiter,
      passwordResetFinishRateLimiter,
    } = await import('../src/middlewares/passwordResetRateLimiters.js');

    expect(RedisStoreMock).toHaveBeenCalledWith({
      prefix: 'rate:password_reset:start:email',
    });
    expect(RedisStoreMock).toHaveBeenCalledWith({
      prefix: 'rate:password_reset:start:ip',
    });
    expect(RedisStoreMock).toHaveBeenCalledWith({
      prefix: 'rate:password_reset:finish',
    });

    const reqStart = {
      method: 'POST',
      ip: '198.51.100.10',
      body: { email: 'User@Test.com' },
    };
    await passwordResetStartEmailRateLimiter(reqStart, {}, jest.fn());
    await passwordResetStartIpRateLimiter(reqStart, {}, jest.fn());

    const reqFinish = {
      method: 'POST',
      ip: '198.51.100.10',
      body: { email: 'User@Test.com' },
    };
    await passwordResetFinishRateLimiter(reqFinish, {}, jest.fn());

    const [startEmailOpts, startIpOpts, finishOpts] = rateLimitMock.calls;
    const emailKey = startEmailOpts.keyGenerator(reqStart);
    const ipKey = startIpOpts.keyGenerator(reqStart);
    const finishKey = finishOpts.keyGenerator(reqFinish);

    expect(emailKey).toMatch(/^email:[a-f0-9]{64}$/);
    expect(emailKey.includes('user@test.com')).toBe(false);
    expect(ipKey).toBe('ip:198.51.100.10/64');
    expect(finishKey).toMatch(/^ip:198\.51\.100\.10\/64\|email:[a-f0-9]{64}$/);

    expect(startEmailOpts.max).toBe(3);
    expect(startEmailOpts.windowMs).toBe(3600000);
    expect(startIpOpts.max).toBe(10);
    expect(startIpOpts.windowMs).toBe(3600000);
    expect(finishOpts.max).toBe(10);
    expect(finishOpts.windowMs).toBe(900000);

    expect(incRateLimitedMock).toHaveBeenCalledWith(
      'password_reset_start_email'
    );
    expect(incRateLimitedMock).toHaveBeenCalledWith('password_reset_start_ip');
    expect(incRateLimitedMock).toHaveBeenCalledWith('password_reset_finish');
    expect(sendErrorMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ status: 429, code: 'rate_limited' })
    );
  });
});
