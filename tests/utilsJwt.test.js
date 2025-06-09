import {expect, test} from '@jest/globals';

process.env.JWT_SECRET = 'secret';
const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } = await import('../src/utils/jwt.js');

const user = { id: '42' };

 test('access token round trip', () => {
  const token = signAccessToken(user);
  const payload = verifyAccessToken(token);
  expect(payload.sub).toBe(user.id);
});

 test('refresh token round trip', () => {
  const token = signRefreshToken(user);
  const payload = verifyRefreshToken(token);
  expect(payload.sub).toBe(user.id);
  expect(payload.type).toBe('refresh');
});

 test('verifyRefreshToken rejects access token', () => {
  const token = signAccessToken(user);
  expect(() => verifyRefreshToken(token)).toThrow('invalid_token_type');
});
