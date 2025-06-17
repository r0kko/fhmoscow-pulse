import { expect, jest, test } from '@jest/globals';

const addRoleMock = jest.fn();
const removeRoleMock = jest.fn();
const getRolesMock = jest.fn();

const user = { addRole: addRoleMock, removeRole: removeRoleMock, getRoles: getRolesMock };

const findByPkMock = jest.fn();
const findRoleMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findByPk: findByPkMock },
  Role: { findOne: findRoleMock },
  UserStatus: { findOne: jest.fn() },
}));

const { default: service } = await import('../src/services/userService.js');

test('assignRole adds role to user', async () => {
  findByPkMock.mockResolvedValue(user);
  findRoleMock.mockResolvedValue({});
  getRolesMock.mockResolvedValue([]);
  await service.assignRole('1', 'ADMIN');
  expect(addRoleMock).toHaveBeenCalled();
});

test('removeRole removes role from user', async () => {
  findByPkMock.mockResolvedValue(user);
  findRoleMock.mockResolvedValue({});
  getRolesMock.mockResolvedValue([{}]);
  await service.removeRole('1', 'ADMIN');
  expect(removeRoleMock).toHaveBeenCalled();
});
