import { expect, jest, test } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const updateUserMock = jest.fn();
const toPublicMock = jest.fn(() => ({ id: '1' }));

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { updateUser: updateUserMock },
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublic: toPublicMock },
}));

const { default: controller } = await import('../src/controllers/userSelfController.js');

test('update returns 400 on validation errors', async () => {
  validationOk = false;
  const req = { user: { id: '1' }, body: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.update(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ errors: [{ msg: 'bad' }] });
  validationOk = true;
});

test('update returns updated user', async () => {
  updateUserMock.mockResolvedValue({ id: '1' });
  const req = { user: { id: '1' }, body: { first_name: 'A' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.update(req, res);
  expect(updateUserMock).toHaveBeenCalledWith('1', { first_name: 'A' });
  expect(res.json).toHaveBeenCalledWith({ user: { id: '1' } });
});
