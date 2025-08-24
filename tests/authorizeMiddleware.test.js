import { jest, expect, test } from '@jest/globals';
import authorize from '../src/middlewares/authorize.js';

function makeReq(hasRole = true) {
  return {
    user: { getRoles: jest.fn(() => (hasRole ? [{}] : [])) },
  };
}

test('allows request when user has role', async () => {
  const req = makeReq(true);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  const mw = authorize('ADMIN');
  await mw(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('allows request when user has one of multiple roles', async () => {
  const req = makeReq(true);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  const mw = authorize('ADMIN', 'REFEREE');
  await mw(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('forbids request when user lacks role', async () => {
  const req = makeReq(false);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  const mw = authorize('ADMIN');
  await mw(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

test('returns 401 when user missing', async () => {
  const req = {};
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  const mw = authorize('ADMIN');
  await mw(req, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test('returns 500 on unexpected error', async () => {
  const req = { user: { getRoles: jest.fn(() => { throw new Error('x'); }) } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  const mw = authorize('ADMIN');
  await mw(req, res, next);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(next).not.toHaveBeenCalled();
});
