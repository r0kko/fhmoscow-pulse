import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const helmetMock = jest.fn();
helmetMock.contentSecurityPolicy = jest.fn();

beforeEach(() => {
  jest.resetModules();
  process.env = { ...process.env, NODE_ENV: 'test' };
  helmetMock.mockReset();
  helmetMock.contentSecurityPolicy.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

jest.unstable_mockModule('helmet', () => ({
  __esModule: true,
  default: helmetMock,
  contentSecurityPolicy: helmetMock.contentSecurityPolicy,
}));

test('enables base CSP by default and allows swagger CSP opt-out', async () => {
  const cfg = await import('../src/config/helmetConfig.js');
  expect(helmetMock).toHaveBeenCalledWith(
    expect.objectContaining({
      contentSecurityPolicy: false,
      frameguard: expect.any(Object),
    })
  );
  expect(cfg.contentSecurityPolicyMiddleware).not.toBeNull();
  expect(cfg.swaggerContentSecurityPolicyMiddleware).not.toBeNull();
});

test('disables CSP and HSTS when env flags are off and adds extras', async () => {
  process.env.SECURITY_ENABLE_CSP = 'false';
  process.env.SECURITY_ENABLE_SWAGGER_CSP = 'false';
  process.env.SECURITY_ENABLE_HSTS = 'false';
  process.env.SECURITY_CSP_CONNECT_SRC = 'https://api.example.com';
  const cfg = await import('../src/config/helmetConfig.js');
  expect(cfg.contentSecurityPolicyMiddleware).toBeNull();
  expect(cfg.swaggerContentSecurityPolicyMiddleware).toBeNull();
  expect(helmetMock).toHaveBeenCalledWith(
    expect.objectContaining({
      hsts: false,
    })
  );
});
