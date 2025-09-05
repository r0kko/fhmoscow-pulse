/* global process */
import { expect, jest, test } from '@jest/globals';

function buildReq(method = 'GET') {
  return { method, session: {}, path: '/' };
}

function buildRes() {
  return { cookie: jest.fn(), locals: {} };
}

test('csrf middleware sets lax cookie in development', async () => {
  process.env.NODE_ENV = 'development';
  jest.resetModules();
  const { default: csrf } = await import('../src/config/csrf.js');
  const expectedName = process.env.CSRF_COOKIE_NAME || 'XSRF-TOKEN-API';
  const req = buildReq();
  const res = buildRes();
  const next = jest.fn();
  csrf(req, res, next);
  expect(res.cookie).toHaveBeenCalledWith(
    expectedName,
    expect.any(String),
    expect.objectContaining({ sameSite: 'lax', secure: false })
  );
  expect(next).toHaveBeenCalled();
});

test('csrf middleware uses sameSite none and secure cookie in production', async () => {
  process.env.NODE_ENV = 'production';
  jest.resetModules();
  const { default: csrf } = await import('../src/config/csrf.js');
  const expectedName = process.env.CSRF_COOKIE_NAME || 'XSRF-TOKEN-API';
  const req = buildReq();
  const res = buildRes();
  const next = jest.fn();
  csrf(req, res, next);
  expect(res.cookie).toHaveBeenCalledWith(
    expectedName,
    expect.any(String),
    expect.objectContaining({ sameSite: 'none', secure: true })
  );
  expect(next).toHaveBeenCalled();
});
