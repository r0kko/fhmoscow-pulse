import { beforeEach, expect, jest, test } from '@jest/globals';
import { Sequelize } from 'sequelize';

const sequelize = new Sequelize('postgres://user:pass@localhost:5432/db', {
  logging: false,
});

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: sequelize,
}));

const hashMock = jest.fn(async (value) => `hashed-${value}`);
const compareMock = jest.fn(async () => true);

jest.unstable_mockModule('bcryptjs', () => ({
  __esModule: true,
  default: { hash: hashMock, compare: compareMock },
  hash: hashMock,
  compare: compareMock,
}));

const { default: User } = await import('../src/models/user.js');

beforeEach(() => {
  hashMock.mockClear();
  compareMock.mockClear();
});

test('beforeCreate hashes plaintext password in place', async () => {
  const user = { password: 'secret' };
  await User.options.hooks.beforeCreate[0](user);
  expect(hashMock).toHaveBeenCalledWith('secret', 10);
  expect(user.password).toBe('hashed-secret');
});

test('beforeUpdate rehashes only when password changed', async () => {
  const user = {
    password: 'new-secret',
    changed: jest.fn((field) => field === 'password'),
  };
  await User.options.hooks.beforeUpdate[0](user);
  expect(hashMock).toHaveBeenCalledWith('new-secret', 10);
  expect(user.password).toBe('hashed-new-secret');

  user.changed.mockReturnValue(false);
  await User.options.hooks.beforeUpdate[0](user);
  expect(hashMock).toHaveBeenCalledTimes(1);
});

test('validPassword delegates to bcrypt compare', async () => {
  compareMock.mockResolvedValueOnce(true);
  const instance = User.build({ password: 'stored-hash' });
  const result = await instance.validPassword('plain');
  expect(compareMock).toHaveBeenCalledWith('plain', 'stored-hash');
  expect(result).toBe(true);
});
