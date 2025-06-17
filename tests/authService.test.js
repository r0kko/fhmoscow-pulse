import { beforeEach, expect, jest, test } from '@jest/globals';

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
const { default: authService } = await import('../src/services/authService.js');
import * as attemptStore from '../src/services/loginAttempts.js';
import jwt from 'jsonwebtoken';

const updateMock = jest.fn(async function (data) {
  Object.assign(user, data);
});
const user = { id: '1', password: 'hash', update: updateMock };

beforeEach(() => {
  updateMock.mockClear();
  attemptStore._reset();
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

 test('rotateTokens returns new tokens and user', async () => {
  findByPkMock.mockResolvedValue(user);
  const { refreshToken } = authService.issueTokens(user);
  const result = await authService.rotateTokens(refreshToken);
  expect(result.user).toBe(user);
  expect(result.accessToken).toBeDefined();
  expect(result.refreshToken).toBeDefined();
});

 test('rotateTokens rejects token with wrong type', async () => {
  const { accessToken } = authService.issueTokens(user);
  await expect(authService.rotateTokens(accessToken)).rejects.toThrow('invalid_token');
});

 test('rotateTokens rejects missing user', async () => {
  findByPkMock.mockResolvedValue(null);
  const { refreshToken } = authService.issueTokens(user);
  await expect(authService.rotateTokens(refreshToken)).rejects.toThrow('user_not_found');
});
