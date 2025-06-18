import { expect, jest, test } from '@jest/globals';

process.env.NODE_ENV = 'test';

const csurfMock = jest.fn(() => 'mw');

jest.unstable_mockModule('csurf', () => ({
  __esModule: true,
  default: csurfMock,
}));

const { default: csrf } = await import('../src/middlewares/csrf.js');

test('configures csurf with cookie options', () => {
  expect(csrf).toBe('mw');
  expect(csurfMock).toHaveBeenCalledWith({
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
    },
  });
});
