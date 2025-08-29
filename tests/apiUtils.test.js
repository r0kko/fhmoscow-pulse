import { expect, test, jest } from '@jest/globals';
import { sendError } from '../src/utils/api.js';

test('sendError uses provided status and code', () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  sendError(res, { status: 404, code: 'not_found' }, 400);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: 'not_found' });
});

test('sendError falls back to message and default status', () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  sendError(res, { message: 'oops' });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'oops' });
});

test('sendError uses internal_error when no details provided', () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  sendError(res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'internal_error' });
});

test('sendError sets Retry-After header when provided', () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    set: jest.fn(),
  };
  sendError(res, { status: 401, code: 'account_locked', retryAfter: 123 });
  expect(res.set).toHaveBeenCalledWith('Retry-After', '123');
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith({ error: 'account_locked' });
});

test('sendError rounds Retry-After to at least 1 second', () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    set: jest.fn(),
  };
  sendError(res, { status: 401, code: 'account_locked', retryAfter: 0.2 });
  expect(res.set).toHaveBeenCalledWith('Retry-After', '1');
});
