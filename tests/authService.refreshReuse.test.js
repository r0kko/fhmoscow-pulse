import { describe, expect, jest, test, beforeEach } from '@jest/globals';

process.env.JWT_SECRET = 'secret';

const mem = {
  current: new Map(),
  used: new Set(),
};

jest.unstable_mockModule('../src/services/refreshStore.js', () => ({
  __esModule: true,
  rememberIssued: async ({ sub, ver, jti, exp }) => {
    void exp;
    mem.current.set(`${sub}:${ver}`, jti);
  },
  markUsed: async ({ sub, ver, jti, exp }) => {
    void exp;
    mem.used.add(`${sub}:${ver}:${jti}`);
  },
  isUsed: async ({ sub, ver, jti }) => {
    return mem.used.has(`${sub}:${ver}:${jti}`);
  },
  currentJti: async ({ sub, ver }) => {
    return mem.current.get(`${sub}:${ver}`) || null;
  },
}));

const findByPkMock = jest.fn();
jest.unstable_mockModule('../src/models/user.js', () => ({
  __esModule: true,
  default: { findByPk: findByPkMock },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  UserStatus: { findOne: jest.fn().mockResolvedValue(null) },
}));

const { signRefreshTokenWithJti } = await import('../src/utils/jwt.js');
const { default: authService } = await import('../src/services/authService.js');

describe('authService refresh reuse detection', () => {
  beforeEach(() => {
    mem.current.clear();
    mem.used.clear();
    findByPkMock.mockReset();
  });

  test('detects reuse of refresh token after successful rotation', async () => {
    const user = {
      id: 'u1',
      token_version: 1,
      increment: jest.fn().mockImplementation(function () {
        this.token_version += 1;
        return Promise.resolve();
      }),
      reload: jest.fn().mockResolvedValue({ id: 'u1', token_version: 2 }),
      getRoles: jest.fn().mockResolvedValue([]),
    };
    findByPkMock.mockResolvedValue(user);

    // Issue a refresh with a fixed jti for deterministic test
    const token = signRefreshTokenWithJti(user, 'j1');

    // First rotation succeeds
    const out = await authService.rotateTokens(token);
    expect(out).toHaveProperty('accessToken');
    expect(out).toHaveProperty('refreshToken');
    expect(user.increment).toHaveBeenCalled();

    // Reuse the same token (now stale): should be detected and rejected
    await expect(authService.rotateTokens(token)).rejects.toThrow();
  });
});
