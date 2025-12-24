import { beforeEach, expect, jest, test } from '@jest/globals';

const setStatusMock = jest.fn();
const resetPasswordMock = jest.fn();
const assignRoleMock = jest.fn();
const removeRoleMock = jest.fn();
const toPublicMock = jest.fn((u) => u);

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: {
    setStatus: setStatusMock,
    resetPassword: resetPasswordMock,
    assignRole: assignRoleMock,
    removeRole: removeRoleMock,
  },
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublic: toPublicMock },
}));

const createPassportMock = jest.fn();
const getPassportMock = jest.fn();
const removePassportMock = jest.fn();
const passportToPublicMock = jest.fn((p) => p);
const sendActivationEmailMock = jest.fn();

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
  default: { sendAccountActivatedEmail: sendActivationEmailMock },
}));

const { default: controller } =
  await import('../src/controllers/userAdminController.js');

beforeEach(() => {
  sendActivationEmailMock.mockClear();
  setStatusMock.mockClear();
});

test('approve updates user status to ACTIVE', async () => {
  setStatusMock.mockResolvedValue({ id: '1' });
  const req = { params: { id: '1' }, user: { id: 'admin' } };
  const res = { json: jest.fn() };
  await controller.approve(req, res);
  expect(setStatusMock).toHaveBeenCalledWith('1', 'ACTIVE', 'admin');
  expect(sendActivationEmailMock).toHaveBeenCalledWith({ id: '1' });
  expect(res.json).toHaveBeenCalledWith({ user: { id: '1' } });
});

test('block updates user status to INACTIVE', async () => {
  setStatusMock.mockResolvedValue({ id: '2' });
  const req = { params: { id: '2' }, user: { id: 'admin' } };
  const res = { json: jest.fn() };
  await controller.block(req, res);
  expect(setStatusMock).toHaveBeenCalledWith('2', 'INACTIVE', 'admin');
  expect(res.json).toHaveBeenCalledWith({ user: { id: '2' } });
});

test('unblock updates user status to ACTIVE', async () => {
  setStatusMock.mockResolvedValue({ id: '3' });
  const req = { params: { id: '3' }, user: { id: 'admin' } };
  const res = { json: jest.fn() };
  await controller.unblock(req, res);
  expect(setStatusMock).toHaveBeenCalledWith('3', 'ACTIVE', 'admin');
  expect(sendActivationEmailMock).toHaveBeenCalledWith({ id: '3' });
  expect(res.json).toHaveBeenCalledWith({ user: { id: '3' } });
});

test('resetPassword returns updated user', async () => {
  resetPasswordMock.mockResolvedValue({ id: '4' });
  const req = {
    params: { id: '4' },
    body: { password: 'P' },
    user: { id: 'admin' },
  };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.resetPassword(req, res);
  expect(resetPasswordMock).toHaveBeenCalledWith('4', 'P', 'admin');
  expect(res.json).toHaveBeenCalledWith({ user: { id: '4' } });
});

test('assignRole assigns role to user', async () => {
  assignRoleMock.mockResolvedValue({ id: '5' });
  const req = {
    params: { id: '5', roleAlias: 'ADMIN' },
    user: { id: 'admin' },
  };
  const res = { json: jest.fn() };
  await controller.assignRole(req, res);
  expect(assignRoleMock).toHaveBeenCalledWith('5', 'ADMIN', 'admin');
  expect(res.json).toHaveBeenCalledWith({ user: { id: '5' } });
});

test('removeRole removes role from user', async () => {
  removeRoleMock.mockResolvedValue({ id: '6' });
  const req = {
    params: { id: '6', roleAlias: 'ADMIN' },
    user: { id: 'admin' },
  };
  const res = { json: jest.fn() };
  await controller.removeRole(req, res);
  expect(removeRoleMock).toHaveBeenCalledWith('6', 'ADMIN', 'admin');
  expect(res.json).toHaveBeenCalledWith({ user: { id: '6' } });
});

test('getPassport returns 404 when not found', async () => {
  getPassportMock.mockResolvedValue(null);
  const req = { params: { id: '7' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.getPassport(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: 'passport_not_found' });
});

test('addPassport stores new passport', async () => {
  createPassportMock.mockResolvedValue({ id: 'p1' });
  const req = {
    params: { id: '8' },
    user: { id: 'admin' },
    body: { number: '12' },
  };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.addPassport(req, res);
  expect(createPassportMock).toHaveBeenCalledWith(
    '8',
    { number: '12' },
    'admin'
  );
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ passport: { id: 'p1' } });
});
