import { beforeEach, expect, jest, test } from '@jest/globals';

process.env.EMAIL_CODE_SECRET = 'email-code-secret';

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

const { hashEmailCode } = await import('../src/utils/emailCode.js');
const { sendCode, verifyCode } =
  await import('../src/services/passwordResetService.js');

function createRecord({
  id = 'rec-1',
  userId = 'u1',
  purpose = 'password_reset',
  code = '123456',
  attemptCount = 0,
} = {}) {
  const record = {
    id,
    user_id: userId,
    purpose,
    code_hash: hashEmailCode({ code, recordId: id, userId, purpose }),
    attempt_count: attemptCount,
    expires_at: new Date(Date.now() + 10 * 60 * 1000),
    consumed_at: null,
    locked_until: null,
    update: jest.fn(async (patch) => {
      Object.assign(record, patch);
      return record;
    }),
  };
  return record;
}

beforeEach(() => {
  createMock.mockReset();
  destroyMock.mockReset();
  findOneMock.mockReset();
  sendEmailMock.mockReset();
});

test('sendCode stores only hash and sends 6-digit code', async () => {
  findOneMock.mockResolvedValueOnce(null); // cooldown lookup
  const user = { id: 'u1' };
  await sendCode(user);

  expect(createMock).toHaveBeenCalledTimes(1);
  const payload = createMock.mock.calls[0][0];
  expect(payload.user_id).toBe('u1');
  expect(payload.purpose).toBe('password_reset');
  expect(payload.code).toBeNull();
  expect(payload.code_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(sendEmailMock).toHaveBeenCalledTimes(1);
  expect(sendEmailMock.mock.calls[0][1]).toMatch(/^\d{6}$/);
});

test('verifyCode succeeds with correct code hash', async () => {
  const user = { id: 'u1' };
  const record = createRecord({ userId: 'u1', code: '123456' });
  findOneMock.mockResolvedValue(record);
  destroyMock.mockResolvedValue(1);

  await verifyCode(user, '123456');

  expect(record.update).toHaveBeenCalledWith(
    expect.objectContaining({ consumed_at: expect.any(Date), locked_until: null })
  );
  expect(destroyMock).toHaveBeenCalled();
});

test('verifyCode locks after five invalid attempts and invalidates code', async () => {
  const user = { id: 'u1' };
  const record = createRecord({ userId: 'u1', code: '123456' });

  findOneMock.mockImplementation(async (query) => {
    const where = query?.where || {};
    if (Object.prototype.hasOwnProperty.call(where, 'consumed_at')) {
      return record.consumed_at ? null : record;
    }
    return record;
  });

  await expect(verifyCode(user, '000001')).rejects.toThrow('invalid_code');
  await expect(verifyCode(user, '000002')).rejects.toThrow('invalid_code');
  await expect(verifyCode(user, '000003')).rejects.toThrow('invalid_code');
  await expect(verifyCode(user, '000004')).rejects.toThrow('invalid_code');
  await expect(verifyCode(user, '000005')).rejects.toThrow('too_many_attempts');

  expect(record.attempt_count).toBe(5);
  expect(record.consumed_at).toBeInstanceOf(Date);
  expect(record.locked_until).toBeInstanceOf(Date);

  await expect(verifyCode(user, '123456')).rejects.toThrow('invalid_code');
});

test('sendCode rejects while cooldown is active', async () => {
  const lockUntil = new Date(Date.now() + 5 * 60 * 1000);
  findOneMock.mockResolvedValueOnce({ locked_until: lockUntil });

  await expect(sendCode({ id: 'u1' })).rejects.toThrow('too_many_attempts');
  expect(sendEmailMock).not.toHaveBeenCalled();
  expect(createMock).not.toHaveBeenCalled();
});
