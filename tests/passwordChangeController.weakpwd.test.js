import { expect, jest, test } from '@jest/globals';

// Force validation to report weak password on new_password
jest.unstable_mockModule('express-validator', () => ({
  __esModule: true,
  validationResult: () => ({
    isEmpty: () => false,
    array: () => [{ path: 'new_password', msg: 'weak_password' }],
  }),
}));

const { default: controller } =
  await import('../src/controllers/passwordChangeController.js');

function createRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

test('changeSelf returns weak_password when new_password invalid', async () => {
  const req = {
    body: { current_password: 'cur', new_password: 'weak' },
    user: { id: 'u1' },
  };
  const res = createRes();
  await controller.changeSelf(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'weak_password' });
});
