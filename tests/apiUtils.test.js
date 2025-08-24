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

