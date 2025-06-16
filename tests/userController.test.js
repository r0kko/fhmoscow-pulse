import { expect, jest, test } from '@jest/globals';

const findAllMock = jest.fn();
const findByPkMock = jest.fn();

jest.unstable_mockModule('../src/models/user.js', () => ({
  __esModule: true,
  default: { findAll: findAllMock, findByPk: findByPkMock },
}));

const toPublicArrayMock = jest.fn((u) => u);
const toPublicMock = jest.fn((u) => u);

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublicArray: toPublicArrayMock, toPublic: toPublicMock },
}));

const { default: userController } = await import('../src/controllers/userController.js');

 test('list returns mapped users', async () => {
  const req = {};
  const res = { json: jest.fn(), locals: {} };
  findAllMock.mockResolvedValue([{ id: '1' }]);
  toPublicArrayMock.mockReturnValue([{ id: '1' }]);

  await userController.list(req, res);

  expect(findAllMock).toHaveBeenCalled();
  expect(toPublicArrayMock).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ users: [{ id: '1' }] });
});

 test('get returns mapped user when found', async () => {
  const req = { params: { id: '1' } };
  const res = { json: jest.fn(), locals: {}, status: jest.fn().mockReturnThis() };
  const user = { id: '1' };
  findByPkMock.mockResolvedValue(user);
  toPublicMock.mockReturnValue({ id: '1' });

  await userController.get(req, res);

  expect(findByPkMock).toHaveBeenCalledWith('1');
  expect(res.json).toHaveBeenCalledWith({ user: { id: '1' } });
});

 test('get returns 404 when missing', async () => {
  const req = { params: { id: '1' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  findByPkMock.mockResolvedValue(null);

  await userController.get(req, res);

  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
});
