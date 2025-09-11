import { expect, test, jest } from '@jest/globals';
import { sendError } from '../src/utils/api.js';

test('sendError masks details for 5xx and sets metric header safely', () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    set: jest.fn(),
  };
  sendError(res, { status: 503, message: 'db is down' });
  expect(res.set).toHaveBeenCalledWith('X-Error-Code', 'internal_error');
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith({ error: 'internal_error' });
});
