import { expect, jest, test } from '@jest/globals';

// Mock validator to simulate weak password error on finish
jest.unstable_mockModule('express-validator', () => ({
  __esModule: true,
  validationResult: () => ({
    isEmpty: () => false,
    array: () => [{ path: 'password', msg: 'weak_password' }],
  }),
}));

const { default: controller } = await import(
  '../src/controllers/passwordResetController.js'
);

function createRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

test('finish returns weak_password when password invalid', async () => {
  const req = {
    body: { email: 't@example.com', code: '1234', password: 'weak' },
  };
  const res = createRes();
  await controller.finish(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'weak_password' });
});
