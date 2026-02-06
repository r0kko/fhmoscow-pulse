import { beforeEach, expect, jest, test } from '@jest/globals';

process.env.EMAIL_CODE_SECRET = 'email-code-secret';

const createMock = jest.fn();
const destroyMock = jest.fn();
const findOneMock = jest.fn();
const statusFindMock = jest.fn();
const sendVerificationEmailMock = jest.fn();
const sendSignTypeEmailMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  EmailCode: { create: createMock, destroy: destroyMock, findOne: findOneMock },
  UserStatus: { findOne: statusFindMock },
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendVerificationEmail: sendVerificationEmailMock,
    sendSignTypeSelectionEmail: sendSignTypeEmailMock,
    sendDocumentSignCodeEmail: jest.fn(),
  },
}));

const { hashEmailCode } = await import('../src/utils/emailCode.js');
const { sendCode, verifyCode, verifyCodeOnly } = await import(
  '../src/services/emailVerificationService.js'
);

function createRecord({
  id = 'rec-v1',
  userId = 'u1',
  purpose = 'verify',
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
  statusFindMock.mockReset();
  sendVerificationEmailMock.mockReset();
  sendSignTypeEmailMock.mockReset();
});

test('sendCode stores hash for verify purpose and sends 6-digit email code', async () => {
  findOneMock.mockResolvedValueOnce(null); // cooldown lookup
  const user = { id: 'u1' };
  await sendCode(user);

  const payload = createMock.mock.calls[0][0];
  expect(payload.user_id).toBe('u1');
  expect(payload.purpose).toBe('verify');
  expect(payload.code).toBeNull();
  expect(payload.code_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(sendVerificationEmailMock).toHaveBeenCalledWith(
    user,
    expect.stringMatching(/^\d{6}$/)
  );
});

test('sendCode maps sign-type to sign_type purpose', async () => {
  findOneMock.mockResolvedValueOnce(null); // cooldown lookup
  const user = { id: 'u1' };
  await sendCode(user, 'sign-type');
  const payload = createMock.mock.calls[0][0];
  expect(payload.purpose).toBe('sign_type');
  expect(sendSignTypeEmailMock).toHaveBeenCalledWith(
    user,
    expect.stringMatching(/^\d{6}$/)
  );
});

test('sendCode rejects during active cooldown', async () => {
  findOneMock.mockResolvedValueOnce({
    locked_until: new Date(Date.now() + 3 * 60 * 1000),
  });
  await expect(sendCode({ id: 'u1' })).rejects.toThrow('too_many_attempts');
  expect(createMock).not.toHaveBeenCalled();
});

test('verifyCode confirms user when code matches', async () => {
  const user = { id: 'u1', update: jest.fn() };
  const record = createRecord({ userId: 'u1', purpose: 'verify', code: '123456' });
  findOneMock.mockResolvedValue(record);
  destroyMock.mockResolvedValue(1);
  statusFindMock.mockResolvedValue({ id: 'ACTIVE' });

  await verifyCode(user, '123456', 'ACTIVE');

  expect(statusFindMock).toHaveBeenCalledWith({ where: { alias: 'ACTIVE' } });
  expect(user.update).toHaveBeenCalledWith({
    email_confirmed: true,
    status_id: 'ACTIVE',
  });
});

test('verifyCodeOnly respects type and locks after five invalid attempts', async () => {
  const user = { id: 'u1' };
  const record = createRecord({
    userId: 'u1',
    purpose: 'doc_sign',
    code: '654321',
  });

  findOneMock.mockImplementation(async (query) => {
    const where = query?.where || {};
    if (Object.prototype.hasOwnProperty.call(where, 'consumed_at')) {
      if (where.purpose !== 'doc_sign') return null;
      return record.consumed_at ? null : record;
    }
    return null;
  });

  await expect(verifyCodeOnly(user, '111111', 'doc-sign')).rejects.toThrow(
    'invalid_code'
  );
  await expect(verifyCodeOnly(user, '222222', 'doc-sign')).rejects.toThrow(
    'invalid_code'
  );
  await expect(verifyCodeOnly(user, '333333', 'doc-sign')).rejects.toThrow(
    'invalid_code'
  );
  await expect(verifyCodeOnly(user, '444444', 'doc-sign')).rejects.toThrow(
    'invalid_code'
  );
  await expect(verifyCodeOnly(user, '555555', 'doc-sign')).rejects.toThrow(
    'too_many_attempts'
  );
  await expect(verifyCodeOnly(user, '654321', 'doc-sign')).rejects.toThrow(
    'invalid_code'
  );
});
