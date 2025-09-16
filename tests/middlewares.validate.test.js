import { beforeEach, expect, jest, test } from '@jest/globals';

let validationResultImpl;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => validationResultImpl),
}));

const { default: validate } = await import('../src/middlewares/validate.js');

beforeEach(() => {
  validationResultImpl = {
    isEmpty: () => true,
    array: () => [],
  };
});

test('passes through when validation has no errors', () => {
  const next = jest.fn();
  validate({}, {}, next);
  expect(next).toHaveBeenCalledTimes(1);
});

test('returns legacy weak password error', () => {
  validationResultImpl = {
    isEmpty: () => false,
    array: () => [{ msg: 'weak_password', path: 'password' }],
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  validate({}, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'weak_password' });
});

test('normalizes errors with field and code', () => {
  validationResultImpl = {
    isEmpty: () => false,
    array: () => [
      { msg: 'Field missing!!!', path: 'name' },
      { msg: Symbol('bad'), param: 'age' },
      { msg: '', path: '' },
    ],
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  validate({}, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({
    error: 'validation_error',
    details: [
      { field: 'name', code: 'field_missing' },
      { field: 'age', code: 'symbol_bad' },
      { field: 'unknown', code: 'invalid_value' },
    ],
  });
});
