import { beforeEach, expect, jest, test } from '@jest/globals';
jest.resetModules();

const createMock = jest.fn();
const destroyMock = jest.fn();
const findOneMock = jest.fn();
const statusFindMock = jest.fn();
const sendEmailMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  EmailCode: { create: createMock, destroy: destroyMock, findOne: findOneMock },
  UserStatus: { findOne: statusFindMock },
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: { sendVerificationEmail: sendEmailMock },
}));

let attemptStore;
let sendCode;
let verifyCode;

beforeEach(async () => {
  jest.resetModules();
  attemptStore = await import('../src/services/emailCodeAttempts.js');
  ({ sendCode, verifyCode } = await import('../src/services/emailVerificationService.js'));
  createMock.mockClear();
  destroyMock.mockClear();
  findOneMock.mockClear();
  statusFindMock.mockClear();
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
  const user = { id: '1', update: jest.fn() };
  findOneMock.mockResolvedValue({ code: '123456' });
  statusFindMock.mockResolvedValue({ id: 's1' });
  destroyMock.mockResolvedValue();
  await verifyCode(user, '123456');
  expect(user.update).toHaveBeenCalled();
  expect(attemptStore.get('1')).toBe(0);
});

test('verifyCode counts failed attempts and locks after five', async () => {
  const user = { id: '1', update: jest.fn() };
  findOneMock.mockResolvedValue(null);
  await expect(verifyCode(user, '111111')).rejects.toThrow('invalid_code');
  await expect(verifyCode(user, '111111')).rejects.toThrow('invalid_code');
  await expect(verifyCode(user, '111111')).rejects.toThrow('invalid_code');
  await expect(verifyCode(user, '111111')).rejects.toThrow('invalid_code');
  await expect(verifyCode(user, '111111')).rejects.toThrow('too_many_attempts');
  expect(attemptStore.get('1')).toBe(5);
});
