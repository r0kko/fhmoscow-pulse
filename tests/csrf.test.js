/* global process */
import { expect, jest, test } from '@jest/globals';

function buildReq(method = 'GET') {
  return { method, session: {}, path: '/' };
}

function buildRes() {
  return { cookie: jest.fn(), locals: {} };
}

test('csrf middleware sets cookie with strict sameSite', async () => {
  process.env.NODE_ENV = 'development';
  jest.resetModules();
  const { default: csrf } = await import('../src/config/csrf.js');
  const req = buildReq();
  const res = buildRes();
  const next = jest.fn();
  csrf(req, res, next);
  expect(res.cookie).toHaveBeenCalledWith(
    'XSRF-TOKEN',
    expect.any(String),
    expect.objectContaining({ sameSite: 'strict', secure: false })
  );
  expect(next).toHaveBeenCalled();
});

test('csrf middleware uses secure cookie in production', async () => {
  process.env.NODE_ENV = 'production';
  jest.resetModules();
  const { default: csrf } = await import('../src/config/csrf.js');
  const req = buildReq();
  const res = buildRes();
  const next = jest.fn();
  csrf(req, res, next);
  expect(res.cookie).toHaveBeenCalledWith(
    'XSRF-TOKEN',
    expect.any(String),
    expect.objectContaining({ sameSite: 'strict', secure: true })
  );
  expect(next).toHaveBeenCalled();
});
