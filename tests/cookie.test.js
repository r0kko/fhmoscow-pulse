import {expect, test, jest} from '@jest/globals';
import { setRefreshCookie, clearRefreshCookie } from '../src/utils/cookie.js';

 test('setRefreshCookie calls res.cookie with options', () => {
  const res = { cookie: jest.fn() };
  setRefreshCookie(res, 'token');
  expect(res.cookie).toHaveBeenCalledWith(
    'refresh_token',
    'token',
    expect.objectContaining({
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      maxAge: expect.any(Number),
    })
  );
});

 test('clearRefreshCookie calls res.clearCookie with options', () => {
  const res = { clearCookie: jest.fn() };
  clearRefreshCookie(res);
  expect(res.clearCookie).toHaveBeenCalledWith(
    'refresh_token',
    expect.objectContaining({
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
    })
  );
});
