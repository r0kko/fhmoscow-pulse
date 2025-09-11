import { expect, test, jest } from '@jest/globals';
import { sendError } from '../src/utils/api.js';

test('sendError tolerates header set/metric errors', () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    set: jest.fn(() => {
      throw new Error('boom');
    }),
  };
  expect(() => sendError(res, { status: 400, code: 'bad' })).not.toThrow();
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'bad' });
});
