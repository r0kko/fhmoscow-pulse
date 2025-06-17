import { expect, jest, test } from '@jest/globals';

const addRoleMock = jest.fn();
const removeRoleMock = jest.fn();

const user = { addRole: addRoleMock, removeRole: removeRoleMock };

const findAllMock = jest.fn();
const findByPkMock = jest.fn();
const findRoleMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findByPk: findByPkMock, findAll: findAllMock },
  Role: { findOne: findRoleMock },
  UserStatus: { findOne: jest.fn() },
}));

const { default: service } = await import('../src/services/userService.js');

test('assignRole adds role to user', async () => {
  findByPkMock.mockResolvedValue(user);
  findRoleMock.mockResolvedValue({});
  await service.assignRole('1', 'ADMIN');
  expect(addRoleMock).toHaveBeenCalled();
});

test('removeRole removes role from user', async () => {
  findByPkMock.mockResolvedValue(user);
  findRoleMock.mockResolvedValue({});
  await service.removeRole('1', 'ADMIN');
  expect(removeRoleMock).toHaveBeenCalled();
});

test('listUsers calls model findAll', async () => {
  findAllMock.mockResolvedValue([]);
  const result = await service.listUsers();
  expect(result).toEqual([]);
  expect(findAllMock).toHaveBeenCalled();
});

test('getUser throws on missing user', async () => {
  findByPkMock.mockResolvedValue(null);
  await expect(service.getUser('1')).rejects.toThrow('user_not_found');
});

test('getUser returns user', async () => {
  findByPkMock.mockResolvedValue(user);
  const res = await service.getUser('1');
  expect(res).toBe(user);
  expect(findByPkMock).toHaveBeenCalledWith('1', expect.any(Object));
});
