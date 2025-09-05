import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock the underlying CSRF middleware to observe whether it is invoked
const mockLuscaCsrf = jest.fn((req, _res, next) => next());

// Use ESM mocking before importing the module under test
jest.unstable_mockModule('../../src/config/csrf.js', () => ({
  default: mockLuscaCsrf,
}));

const { default: csrfMiddleware } = await import(
  '../../src/middlewares/csrf.js'
);

function makeReq(method, path) {
  return { method, path };
}

describe('csrfMiddleware', () => {
  beforeEach(() => {
    mockLuscaCsrf.mockClear();
  });

  test('skips for safe GET requests', () => {
    const req = makeReq('GET', '/matches/123/opponent-contacts');
    const res = {};
    const next = jest.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockLuscaCsrf).not.toHaveBeenCalled();
  });

  test('still skips for /csrf-token', () => {
    const req = makeReq('GET', '/csrf-token');
    const res = {};
    const next = jest.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockLuscaCsrf).not.toHaveBeenCalled();
  });

  test('enforces for state-changing requests', () => {
    const req = makeReq('POST', '/documents');
    const res = {};
    const next = jest.fn();
    csrfMiddleware(req, res, next);
    expect(mockLuscaCsrf).toHaveBeenCalledTimes(1);
    // our mock calls next()
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('enforces for login POST', () => {
    const req = makeReq('POST', '/auth/login');
    const res = {};
    const next = jest.fn();
    csrfMiddleware(req, res, next);
    expect(mockLuscaCsrf).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
