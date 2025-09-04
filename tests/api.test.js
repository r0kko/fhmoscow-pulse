import { expect, test, jest } from '@jest/globals';
import { sendError } from '../src/utils/api.js';

test('sendError uses default values when err missing', () => {
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) };
  sendError(res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(json).toHaveBeenCalledWith({ error: 'internal_error' });
});

test('sendError takes status and code from error', () => {
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) };
  sendError(res, { status: 403, code: 'forbidden' });
  expect(res.status).toHaveBeenCalledWith(403);
  expect(json).toHaveBeenCalledWith({ error: 'forbidden' });
});

test('sendError falls back to error message', () => {
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) };
  sendError(res, { message: 'bad', status: 401 });
  expect(res.status).toHaveBeenCalledWith(401);
  expect(json).toHaveBeenCalledWith({ error: 'bad' });
});

test('sendError masks 5xx message with internal_error', () => {
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })), set: jest.fn() };
  sendError(res, { message: 'stack/internal details', status: 500 });
  expect(res.status).toHaveBeenCalledWith(500);
  expect(json).toHaveBeenCalledWith({ error: 'internal_error' });
});
