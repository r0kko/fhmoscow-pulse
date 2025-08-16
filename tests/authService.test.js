import { beforeEach, expect, jest, test } from '@jest/globals';
import jwt from 'jsonwebtoken';

const store = new Map();
jest.unstable_mockModule('../src/config/redis.js', () => ({
  __esModule: true,
  default: {
    async get(k) {
      return store.has(k) ? store.get(k) : null;
    },
    async set(k, v) {
      store.set(k, v);
    },
    async del(keys) {
      if (Array.isArray(keys)) {
        keys.forEach((x) => store.delete(x));
      } else {
        store.delete(keys);
      }
    },
    async keys(pattern) {
      const prefix = pattern.replace(/\*/g, '');
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    },
  },
}));

const compareMock = jest.fn();
const findOneMock = jest.fn();
const scopeMock = jest.fn(() => ({ findOne: findOneMock }));
const findByPkMock = jest.fn();
const findStatusMock = jest.fn();

jest.unstable_mockModule('../src/models/user.js', () => ({
  __esModule: true,
  default: { scope: scopeMock, findByPk: findByPkMock },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  UserStatus: { findOne: findStatusMock },
}));

jest.unstable_mockModule('bcryptjs', () => ({
  __esModule: true,
  default: { compare: compareMock },
  compare: compareMock,
}));

// eslint-disable-next-line no-undef
process.env.JWT_SECRET = 'secret';

let authService;
let attemptStore;

const updateMock = jest.fn(async function (data) {
  Object.assign(user, data);
});
const incrementMock = jest.fn(async function () {
  user.token_version = (user.token_version ?? 0) + 1;
});
const reloadMock = jest.fn(async function () {
  return user;
});
const user = {
  id: '1',
  password: 'hash',
  token_version: 0,
  update: updateMock,
  increment: incrementMock,
  reload: reloadMock,
};

beforeEach(async () => {
  await jest.isolateModulesAsync(async () => {
    ({ default: authService } = await import('../src/services/authService.js'));
    attemptStore = await import('../src/services/loginAttempts.js');
  });
  updateMock.mockClear();
  incrementMock.mockClear();
  reloadMock.mockClear();
  await attemptStore._reset();
  user.status_id = undefined;
  user.token_version = 0;
});

test('verifyCredentials returns user when valid', async () => {
  findOneMock.mockResolvedValue(user);
  compareMock.mockResolvedValue(true);
  const res = await authService.verifyCredentials('123', 'pass');
  expect(res).toBe(user);
});

test('verifyCredentials throws for unknown phone', async () => {
  findOneMock.mockResolvedValue(null);
  await expect(authService.verifyCredentials('a', 'b')).rejects.toThrow('invalid_credentials');
});

test('verifyCredentials throws for bad password', async () => {
  findOneMock.mockResolvedValue(user);
  compareMock.mockResolvedValue(false);
  await expect(authService.verifyCredentials('a', 'b')).rejects.toThrow('invalid_credentials');
});

test('verifyCredentials increments attempts and locks account', async () => {
  const inactive = { id: 'i' };
  findStatusMock.mockResolvedValue(inactive);
  findOneMock.mockResolvedValue(user);
  compareMock.mockResolvedValue(false);
  user.status_id = undefined;

  for (let i = 0; i < 4; i++) {
    await expect(authService.verifyCredentials('a', 'b')).rejects.toThrow('invalid_credentials');
  }

  await expect(authService.verifyCredentials('a', 'b')).rejects.toThrow('account_locked');
  expect(updateMock).toHaveBeenCalledWith({ status_id: 'i' });
});

test('verifyCredentials resets attempts on success', async () => {
  user.status_id = undefined;
  findStatusMock.mockResolvedValue({ id: 'i' });
  findOneMock.mockResolvedValue(user);
  compareMock.mockResolvedValue(true);

  await authService.verifyCredentials('a', 'pass');
  expect(updateMock).not.toHaveBeenCalled();
});

 test('issueTokens creates valid JWTs', () => {
  const tokens = authService.issueTokens({ id: '1' });
  const p1 = jwt.verify(tokens.accessToken, 'secret');
  const p2 = jwt.verify(tokens.refreshToken, 'secret');
  expect(p1.sub).toBe('1');
  expect(p2.sub).toBe('1');
  expect(p2.type).toBe('refresh');
});

 test('rotateTokens returns new tokens and user, and bumps version', async () => {
  findByPkMock.mockResolvedValue(user);
  const { refreshToken } = authService.issueTokens(user);
  const result = await authService.rotateTokens(refreshToken);
  expect(result.user).toBe(user);
  expect(result.accessToken).toBeDefined();
  expect(result.refreshToken).toBeDefined();
  expect(incrementMock).toHaveBeenCalledWith('token_version');
  expect(user.token_version).toBe(1);
});

 test('rotateTokens rejects token with wrong type', async () => {
  const { accessToken } = authService.issueTokens(user);
  await expect(authService.rotateTokens(accessToken)).rejects.toThrow('invalid_token_type');
});

test('rotateTokens rejects mismatched token version', async () => {
  // User version is 0, but craft token with ver 1
  findByPkMock.mockResolvedValue(user);
  const token = jwt.sign({ sub: user.id, type: 'refresh', ver: 1 }, 'secret');
  await expect(authService.rotateTokens(token)).rejects.toThrow('invalid_token');
});

test('rotateTokens rejects missing user', async () => {
  findByPkMock.mockResolvedValue(null);
  const { refreshToken } = authService.issueTokens(user);
  await expect(authService.rotateTokens(refreshToken)).rejects.toThrow('user_not_found');
});

test('rotateTokens rejects inactive user', async () => {
  user.status_id = 'i';
  findByPkMock.mockResolvedValue(user);
  findStatusMock.mockResolvedValue({ id: 'i' });
  const { refreshToken } = authService.issueTokens(user);
  await expect(authService.rotateTokens(refreshToken)).rejects.toThrow('account_locked');
});
