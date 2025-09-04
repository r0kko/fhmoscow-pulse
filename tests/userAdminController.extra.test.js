import { beforeEach, expect, jest, test, describe } from '@jest/globals';

// Mocks for services and mappers used by the controller
const listUsersMock = jest.fn();
const getUserMock = jest.fn();
const createUserMock = jest.fn();
const updateUserMock = jest.fn();
const setStatusMock = jest.fn();
const resetPasswordMock = jest.fn();
const assignRoleMock = jest.fn();
const removeRoleMock = jest.fn();

const userToPublicMock = jest.fn((u) => u);

const createPassportMock = jest.fn();
const getPassportMock = jest.fn();
const removePassportMock = jest.fn();
const passportToPublicMock = jest.fn((p) => p);

const sendActivationEmailMock = jest.fn();
const sendUserCreatedEmailMock = jest.fn();

// Mock modules for this file
jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: {
    listUsers: listUsersMock,
    getUser: getUserMock,
    createUser: createUserMock,
    updateUser: updateUserMock,
    setStatus: setStatusMock,
    resetPassword: resetPasswordMock,
    assignRole: assignRoleMock,
    removeRole: removeRoleMock,
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

// By default, validation passes (no errors)
jest.unstable_mockModule('express-validator', () => ({
  __esModule: true,
  validationResult: () => ({ isEmpty: () => true, array: () => [] }),
}));

const { default: controller } = await import(
  '../src/controllers/userAdminController.js'
);

function mockRes() {
  return {
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
    expect(listUsersMock).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ users: [{ id: 'u1' }], total: 1 });
  });

  test('get returns public user when found', async () => {
    getUserMock.mockResolvedValue({ id: 'u2' });
    const res = mockRes();
    await controller.get({ params: { id: 'u2' } }, res);
    expect(res.json).toHaveBeenCalledWith({ user: { id: 'u2' } });
  });

  test('get returns 404 via sendError when not found', async () => {
    getUserMock.mockRejectedValue(new Error('not found'));
    const res = mockRes();
    await controller.get({ params: { id: 'missing' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('create returns 201 and user, sends email and generates password', async () => {
    createUserMock.mockResolvedValue({ id: 'u3' });
    const req = { body: { email: 'a@b.c' }, user: { id: 'admin' } };
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
    // Ensure password does not contain HTML-problematic ampersand
    const [, generatedPassword] = sendUserCreatedEmailMock.mock.calls.at(-1);
    expect(generatedPassword).not.toMatch(/&/);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ user: { id: 'u3' } });
  });

  test('create returns 400 via sendError when email exists', async () => {
    createUserMock.mockRejectedValue({ status: 400, message: 'email_exists' });
    const req = { body: { email: 'dup@example.com' }, user: { id: 'admin' } };
    const res = mockRes();
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'email_exists' });
  });

  test('update returns mapped user on success', async () => {
    updateUserMock.mockResolvedValue({ id: 'u4' });
    const req = {
      params: { id: 'u4' },
      body: { first_name: 'A' },
      user: { id: 'admin' },
    };
    const res = mockRes();
    await controller.update(req, res);
    expect(updateUserMock).toHaveBeenCalledWith(
      'u4',
      { first_name: 'A' },
      'admin'
    );
    expect(res.json).toHaveBeenCalledWith({ user: { id: 'u4' } });
  });

  test('update returns 404 via sendError on service error', async () => {
    updateUserMock.mockRejectedValue(new Error('nope'));
    const req = { params: { id: 'uX' }, body: {}, user: { id: 'admin' } };
    const res = mockRes();
    await controller.update(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
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

describe('userAdminController validation error flows', () => {
  test('create returns 400 on validation errors', async () => {
    jest.resetModules();
    const listUsersMock2 = jest.fn();
    const createUserMock2 = jest.fn();
    // remock modules with validation failing
    jest.unstable_mockModule('../src/services/userService.js', () => ({
      __esModule: true,
      default: { listUsers: listUsersMock2, createUser: createUserMock2 },
    }));
    jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
      __esModule: true,
      default: { toPublic: (u) => u, toPublicArray: (arr) => arr },
    }));
    jest.unstable_mockModule('express-validator', () => ({
      __esModule: true,
      validationResult: () => ({
        isEmpty: () => false,
        array: () => [{ msg: 'bad' }],
      }),
    }));
    const { default: controller2 } = await import(
      '../src/controllers/userAdminController.js'
    );

    const res = mockRes();
    await controller2.create({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ errors: [{ msg: 'bad' }] });
  });

  test('resetPassword returns 400 on validation errors', async () => {
    jest.resetModules();
    const resetPasswordMock2 = jest.fn();
    jest.unstable_mockModule('../src/services/userService.js', () => ({
      __esModule: true,
      default: { resetPassword: resetPasswordMock2 },
    }));
    jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
      __esModule: true,
      default: { toPublic: (u) => u },
    }));
    jest.unstable_mockModule('express-validator', () => ({
      __esModule: true,
      validationResult: () => ({ isEmpty: () => false, array: () => ['x'] }),
    }));
    const { default: controller3 } = await import(
      '../src/controllers/userAdminController.js'
    );
    const res = mockRes();
    await controller3.resetPassword(
      { params: { id: 'u' }, body: { password: 'p' }, user: { id: 'a' } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
