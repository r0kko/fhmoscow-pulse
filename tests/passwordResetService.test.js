import { beforeEach, expect, jest, test } from '@jest/globals';

const createMock = jest.fn();
const destroyMock = jest.fn();
const findOneMock = jest.fn();
const sendEmailMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  EmailCode: { create: createMock, destroy: destroyMock, findOne: findOneMock },
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: { sendPasswordResetEmail: sendEmailMock },
}));

import * as attemptStore from '../src/services/emailCodeAttempts.js';

const { sendCode, verifyCode } = await import(
  '../src/services/passwordResetService.js'
);

beforeEach(() => {
  createMock.mockClear();
  destroyMock.mockClear();
  findOneMock.mockClear();
  sendEmailMock.mockClear();
  attemptStore._reset();
});

test('sendCode stores plain code and sends email', async () => {
  const user = { id: '1' };
  await sendCode(user);
  expect(createMock).toHaveBeenCalled();
  const data = createMock.mock.calls[0][0];
  expect(data.user_id).toBe('1');
  expect(data.code).toMatch(/^\d{6}$/);
  expect(sendEmailMock).toHaveBeenCalledWith(user, expect.any(String));
});

test('verifyCode succeeds with correct code', async () => {
  const user = { id: '1' };
  findOneMock.mockResolvedValue({ code: '123456' });
  destroyMock.mockResolvedValue();
  await verifyCode(user, '123456');
  expect(attemptStore.get('1')).toBe(0);
});

test('verifyCode counts failed attempts and locks after five', async () => {
  const user = { id: '1' };
  findOneMock.mockResolvedValue(null);
  await expect(verifyCode(user, '111111')).rejects.toThrow('invalid_code');
  await expect(verifyCode(user, '111111')).rejects.toThrow('invalid_code');
  await expect(verifyCode(user, '111111')).rejects.toThrow('invalid_code');
  await expect(verifyCode(user, '111111')).rejects.toThrow('invalid_code');
  await expect(verifyCode(user, '111111')).rejects.toThrow('too_many_attempts');
  expect(attemptStore.get('1')).toBe(5);
});
