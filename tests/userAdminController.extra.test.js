import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const listUsersMock = jest.fn();
const getUserMock = jest.fn();
const createUserMock = jest.fn();
const updateUserMock = jest.fn();
const setStatusMock = jest.fn();
const resetPasswordMock = jest.fn();
const assignRoleMock = jest.fn();
const removeRoleMock = jest.fn();
const setTemporaryPasswordMock = jest.fn();
const bumpTokenVersionMock = jest.fn();

const userToPublicMock = jest.fn((u) => u);

const createPassportMock = jest.fn();
const getPassportMock = jest.fn();
const removePassportMock = jest.fn();
const passportToPublicMock = jest.fn((p) => p);

const sendActivationEmailMock = jest.fn();
const sendUserCreatedEmailMock = jest.fn();

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: {
    listUsers: listUsersMock,
    getUser: getUserMock,
    createUser: createUserMock,
    updateUser: updateUserMock,
    setStatus: setStatusMock,
    resetPassword: resetPasswordMock,
    bumpTokenVersion: bumpTokenVersionMock,
    assignRole: assignRoleMock,
    removeRole: removeRoleMock,
    setTemporaryPassword: setTemporaryPasswordMock,
  },
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublic: userToPublicMock, toPublicArray: (arr) => arr },
}));

jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: {
    createForUser: createPassportMock,
    getByUser: getPassportMock,
    removeByUser: removePassportMock,
  },
}));

jest.unstable_mockModule('../src/mappers/passportMapper.js', () => ({
  __esModule: true,
  default: { toPublic: passportToPublicMock },
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendAccountActivatedEmail: sendActivationEmailMock,
    sendUserCreatedByAdminEmail: sendUserCreatedEmailMock,
  },
}));

jest.unstable_mockModule('express-validator', () => ({
  __esModule: true,
  validationResult: () => ({ isEmpty: () => true, array: () => [] }),
}));

const { default: controller } =
  await import('../src/controllers/userAdminController.js');

function mockRes() {
  return {
    locals: {},
    set: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('userAdminController extra flows', () => {
  test('list returns mapped users and total', async () => {
    listUsersMock.mockResolvedValue({ rows: [{ id: 'u1' }], count: 1 });
    const req = {
      query: {
        search: 'a',
        page: '2',
        limit: '10',
        sort: 'last_name',
        order: 'asc',
      },
    };
    const res = mockRes();
    await controller.list(req, res);
    expect(listUsersMock).toHaveBeenCalledWith({
      search: 'a',
      page: 2,
      limit: 10,
      sort: 'last_name',
      order: 'asc',
      status: '',
      role: '',
      search_scope: 'all',
      search_mode: 'contains_any',
    });
    expect(res.json).toHaveBeenCalledWith({
      users: [{ id: 'u1' }],
      total: 1,
      meta: { total: 1, page: 2, pages: 1, limit: 10 },
    });
  });

  test('list clamps excessive limit to API hard cap', async () => {
    listUsersMock.mockResolvedValue({ rows: [], count: 0 });
    const req = { query: { limit: '1000', page: '1' } };
    const res = mockRes();
    await controller.list(req, res);
    expect(listUsersMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 100 })
    );
    expect(res.json).toHaveBeenCalledWith({
      users: [],
      total: 0,
      meta: { total: 0, page: 1, pages: 1, limit: 100 },
    });
  });

  test('list normalizes custom search options', async () => {
    listUsersMock.mockResolvedValue({ rows: [], count: 0 });
    const req = {
      query: {
        search: 'Петров',
        search_scope: 'FIO',
        search_mode: 'SURNAME_PRIORITY_PREFIX',
      },
    };
    const res = mockRes();
    await controller.list(req, res);
    expect(listUsersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'Петров',
        search_scope: 'fio',
        search_mode: 'surname_priority_prefix',
      })
    );
  });

  test('create returns sent delivery when email was delivered', async () => {
    createUserMock.mockResolvedValue({ id: 'u3' });
    sendUserCreatedEmailMock.mockResolvedValue({ delivered: true });
    const req = { body: { email: 'a@b.c' }, user: { id: 'admin' }, id: 'r1' };
    const res = mockRes();

    await controller.create(req, res);

    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.c', password: expect.any(String) }),
      'admin'
    );
    expect(sendUserCreatedEmailMock).toHaveBeenCalledWith(
      { id: 'u3' },
      expect.any(String)
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      user: { id: 'u3' },
      delivery: {
        invited: true,
        channel: 'email',
        status: 'sent',
      },
    });
  });

  test('create returns queued delivery when queue accepted request', async () => {
    createUserMock.mockResolvedValue({ id: 'u3' });
    sendUserCreatedEmailMock.mockResolvedValue({ accepted: true });
    const req = { body: { email: 'a@b.c' }, user: { id: 'admin' }, id: 'r1' };
    const res = mockRes();

    await controller.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      user: { id: 'u3' },
      delivery: {
        invited: true,
        channel: 'email',
        status: 'queued',
      },
    });
  });

  test('create returns failed delivery when sending throws', async () => {
    createUserMock.mockResolvedValue({ id: 'u3' });
    sendUserCreatedEmailMock.mockRejectedValue(new Error('smtp down'));
    const req = { body: { email: 'a@b.c' }, user: { id: 'admin' }, id: 'r1' };
    const res = mockRes();

    await controller.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      user: { id: 'u3' },
      delivery: {
        invited: false,
        channel: 'email',
        status: 'failed',
        reason: 'delivery_exception',
      },
    });
  });

  test('create returns 400 via sendError when email exists', async () => {
    createUserMock.mockRejectedValue({ status: 400, code: 'email_exists' });
    const req = { body: { email: 'dup@example.com' }, user: { id: 'admin' } };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'email_exists' });
  });

  test('resendInvite rotates temporary password and reports delivery', async () => {
    setTemporaryPasswordMock.mockResolvedValue({ id: 'u9' });
    sendUserCreatedEmailMock.mockResolvedValue({ accepted: true });
    const req = { params: { id: 'u9' }, user: { id: 'admin' }, id: 'r2' };
    const res = mockRes();

    await controller.resendInvite(req, res);

    expect(setTemporaryPasswordMock).toHaveBeenCalledWith(
      'u9',
      expect.any(String),
      'admin'
    );
    expect(sendUserCreatedEmailMock).toHaveBeenCalledWith(
      { id: 'u9' },
      expect.any(String)
    );
    expect(res.json).toHaveBeenCalledWith({
      user: { id: 'u9' },
      delivery: {
        invited: true,
        channel: 'email',
        status: 'queued',
      },
    });
  });

  test('getPassport returns mapped passport when found', async () => {
    getPassportMock.mockResolvedValue({ id: 'p1' });
    const res = mockRes();
    await controller.getPassport({ params: { id: 'u5' } }, res);
    expect(res.json).toHaveBeenCalledWith({ passport: { id: 'p1' } });
  });

  test('deletePassport returns 204 on success', async () => {
    removePassportMock.mockResolvedValue(undefined);
    const res = mockRes();
    await controller.deletePassport({ params: { id: 'u6' } }, res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});
