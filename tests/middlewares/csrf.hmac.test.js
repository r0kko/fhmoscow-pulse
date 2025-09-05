import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock the underlying CSRF (lusca) to observe whether it is invoked
const mockLuscaCsrf = jest.fn((_req, _res, next) => next());

// ESM mock before imports
jest.unstable_mockModule('../../src/config/csrf.js', () => ({
  default: mockLuscaCsrf,
}));

// Import HMAC utils to issue a valid token
const { issueCsrfHmac } = await import('../../src/utils/csrfHmac.js');
const { default: csrfMiddleware } = await import(
  '../../src/middlewares/csrf.js'
);

function makeReq(method, path, headers = {}) {
  return {
    method,
    path,
    get: (name) => headers[name] || headers[name?.toLowerCase?.()] || undefined,
  };
}

describe('csrfMiddleware with HMAC token', () => {
  beforeEach(() => {
    mockLuscaCsrf.mockClear();
    process.env.CSRF_HMAC_TTL_SECONDS = '60';
    process.env.CSRF_HMAC_SECRET = 'test-secret';
  });

  test('accepts valid HMAC token from header and does not invoke lusca', () => {
    const baseReq = makeReq('POST', '/documents', { Origin: 'https://example.com' });
    const token = issueCsrfHmac(baseReq);
    const req = makeReq('POST', '/documents', {
      'X-XSRF-TOKEN': token,
      Origin: 'https://example.com',
    });
    const res = {};
    const next = jest.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockLuscaCsrf).not.toHaveBeenCalled();
  });

  test('falls back to lusca when HMAC token invalid', () => {
    const req = makeReq('POST', '/documents', {
      'X-XSRF-TOKEN': 'invalid.token',
      Origin: 'https://example.com',
    });
    const res = {};
    const next = jest.fn();
    csrfMiddleware(req, res, next);
    expect(mockLuscaCsrf).toHaveBeenCalledTimes(1);
  });
});

