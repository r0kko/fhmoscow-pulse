import { beforeEach, expect, jest, test } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const sendCodeMock = jest.fn();
const verifyCodeMock = jest.fn();

jest.unstable_mockModule('../src/services/passwordResetService.js', () => ({
  __esModule: true,
  default: { sendCode: sendCodeMock, verifyCode: verifyCodeMock },
}));

const resetPasswordMock = jest.fn();

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { resetPassword: resetPasswordMock },
}));

const findUserMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findOne: findUserMock },
}));

const { default: controller } = await import('../src/controllers/passwordResetController.js');

function createRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

beforeEach(() => {
  sendCodeMock.mockClear();
  verifyCodeMock.mockClear();
  resetPasswordMock.mockClear();
  findUserMock.mockReset();
  validationOk = true;
});

test('start sends code when user exists', async () => {
  const user = { id: 'u1' };
  findUserMock.mockResolvedValue(user);
  const req = { body: { email: 't@example.com' } };
  const res = createRes();
  await controller.start(req, res);
  expect(sendCodeMock).toHaveBeenCalledWith(user);
  expect(res.json).toHaveBeenCalledWith({ message: 'code_sent' });
});

test('start returns 404 when user missing', async () => {
  findUserMock.mockResolvedValue(null);
  const req = { body: { email: 'a@b.c' } };
  const res = createRes();
  await controller.start(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: 'not_found' });
});

test('start returns 400 on validation errors', async () => {
  validationOk = false;
  const req = { body: {} };
  const res = createRes();
  await controller.start(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ errors: [{ msg: 'bad' }] });
});

test('finish resets password when code valid', async () => {
  const user = { id: 'u1' };
  findUserMock.mockResolvedValue(user);
  const req = { body: { email: 't@example.com', code: '123', password: 'Passw0rd' } };
  const res = createRes();
  await controller.finish(req, res);
  expect(verifyCodeMock).toHaveBeenCalledWith(user, '123');
  expect(resetPasswordMock).toHaveBeenCalledWith('u1', 'Passw0rd');
  expect(res.json).toHaveBeenCalledWith({ message: 'password_updated' });
});

test('finish returns error when code invalid', async () => {
  const user = { id: 'u1' };
  findUserMock.mockResolvedValue(user);
  verifyCodeMock.mockRejectedValue(new Error('invalid_code'));
  const req = { body: { email: 't@example.com', code: 'bad', password: 'Pass' } };
  const res = createRes();
  await controller.finish(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'invalid_code' });
});
