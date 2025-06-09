import {expect, jest, test} from '@jest/globals';

const verifyMock = jest.fn();
const findByPkMock = jest.fn();

jest.unstable_mockModule('jsonwebtoken', () => ({
  __esModule: true,
  default: { verify: verifyMock },
  verify: verifyMock,
}));

jest.unstable_mockModule('../src/models/user.js', () => ({
  __esModule: true,
  default: { findByPk: findByPkMock },
}));

const { default: auth } = await import('../src/middlewares/auth.js');

 test('valid token attaches user to request', async () => {
  const req = { headers: { authorization: 'Bearer t' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  const user = { id: '1' };
  verifyMock.mockReturnValue({ sub: '1' });
  findByPkMock.mockResolvedValue(user);

  await auth(req, res, next);

  expect(req.user).toBe(user);
  expect(next).toHaveBeenCalled();
});

 test('missing token returns 401', async () => {
  const req = { headers: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await auth(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

 test('user not found returns 401', async () => {
  const req = { headers: { authorization: 'Bearer t' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  verifyMock.mockReturnValue({ sub: '1' });
  findByPkMock.mockResolvedValue(null);

  await auth(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});
