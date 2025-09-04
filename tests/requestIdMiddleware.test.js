import { expect, test } from '@jest/globals';
import requestId from '../src/middlewares/requestId.js';

test('requestId sets header and attaches id to req/res', () => {
  const headers = {};
  const req = {};
  const res = {
    locals: {},
    set: (k, v) => {
      headers[k] = v;
    },
  };
  let called = false;
  requestId(req, res, () => {
    called = true;
  });
  expect(called).toBe(true);
  expect(typeof req.id).toBe('string');
  expect(res.locals.requestId).toBe(req.id);
  expect(headers['X-Request-Id']).toBe(req.id);
});
