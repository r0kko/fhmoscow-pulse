import { afterEach, beforeEach, expect, test } from '@jest/globals';

const saved = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH_LOCKOUT_ENABLED: process.env.AUTH_LOCKOUT_ENABLED,
  AUTH_LOCKOUT_ERROR_V2: process.env.AUTH_LOCKOUT_ERROR_V2,
  RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
  RATE_LIMIT_LOGIN_ENABLED: process.env.RATE_LIMIT_LOGIN_ENABLED,
};

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  delete process.env.AUTH_LOCKOUT_ENABLED;
  delete process.env.RATE_LIMIT_ENABLED;
  delete process.env.RATE_LIMIT_LOGIN_ENABLED;
});

afterEach(() => {
  if (saved.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = saved.NODE_ENV;
  if (saved.AUTH_LOCKOUT_ENABLED === undefined)
    delete process.env.AUTH_LOCKOUT_ENABLED;
  else process.env.AUTH_LOCKOUT_ENABLED = saved.AUTH_LOCKOUT_ENABLED;
  if (saved.AUTH_LOCKOUT_ERROR_V2 === undefined)
    delete process.env.AUTH_LOCKOUT_ERROR_V2;
  else process.env.AUTH_LOCKOUT_ERROR_V2 = saved.AUTH_LOCKOUT_ERROR_V2;
  if (saved.RATE_LIMIT_ENABLED === undefined)
    delete process.env.RATE_LIMIT_ENABLED;
  else process.env.RATE_LIMIT_ENABLED = saved.RATE_LIMIT_ENABLED;
  if (saved.RATE_LIMIT_LOGIN_ENABLED === undefined)
    delete process.env.RATE_LIMIT_LOGIN_ENABLED;
  else process.env.RATE_LIMIT_LOGIN_ENABLED = saved.RATE_LIMIT_LOGIN_ENABLED;
});

test('feature flags default to disabled for UX', async () => {
  const { isLockoutEnabled, isRateLimitEnabled } =
    await import('../src/config/featureFlags.js');
  expect(isLockoutEnabled()).toBe(false);
  expect(isRateLimitEnabled()).toBe(false);
  expect(isRateLimitEnabled('login')).toBe(false);
});

test('AUTH_LOCKOUT_ENABLED enables lockout when true-ish', async () => {
  const { isLockoutEnabled } = await import('../src/config/featureFlags.js');
  process.env.AUTH_LOCKOUT_ENABLED = 'YES';
  expect(isLockoutEnabled()).toBe(true);
});

test('AUTH_LOCKOUT_ERROR_V2 enables temporary lockout v2 code', async () => {
  const { isAuthLockoutErrorV2Enabled } =
    await import('../src/config/featureFlags.js');
  process.env.AUTH_LOCKOUT_ERROR_V2 = 'true';
  expect(isAuthLockoutErrorV2Enabled()).toBe(true);
});

test('RATE_LIMIT_ENABLED acts as global default; per-kind override applies', async () => {
  const { isRateLimitEnabled } = await import('../src/config/featureFlags.js');
  process.env.RATE_LIMIT_ENABLED = 'on';
  expect(isRateLimitEnabled()).toBe(true);
  expect(isRateLimitEnabled('login')).toBe(true);
  process.env.RATE_LIMIT_LOGIN_ENABLED = 'false';
  expect(isRateLimitEnabled('login')).toBe(false);
});

test('production defaults enable lockout and rate limit', async () => {
  process.env.NODE_ENV = 'production';
  const { isLockoutEnabled, isRateLimitEnabled } =
    await import('../src/config/featureFlags.js');
  expect(isLockoutEnabled()).toBe(true);
  expect(isRateLimitEnabled()).toBe(true);
  expect(isRateLimitEnabled('password_reset')).toBe(true);
});
