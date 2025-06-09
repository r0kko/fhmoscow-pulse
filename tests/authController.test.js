import {expect, jest, test} from '@jest/globals';

const findOneMock = jest.fn();
const scopeMock = jest.fn(() => ({ findOne: findOneMock }));

jest.unstable_mockModule('../src/models/user.js', () => ({
  __esModule: true,
  default: { scope: scopeMock },
}));

const compareMock = jest.fn();
jest.unstable_mockModule('bcryptjs', () => ({
  __esModule: true,
  default: { compare: compareMock },
  compare: compareMock,
}));

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({ isEmpty: () => true })),
}));

const { default: authController } = await import('../src/controllers/authController.js');

// eslint-disable-next-line no-undef
process.env.JWT_SECRET = 'secret';

test('login does not include password in response', async () => {
  const user = { id: '1', email: 'a@b.c', password: 'hash', get() { return { id: this.id, email: this.email, password: this.password }; } };
  findOneMock.mockResolvedValue(user);
  compareMock.mockResolvedValue(true);

  const req = { body: { email: 'a@b.c', password: 'pass' }, cookies: {} };
  const res = { json: jest.fn(), cookie: jest.fn(), status: jest.fn().mockReturnThis() };

  await authController.login(req, res);

  const response = res.json.mock.calls[0][0];
  expect(response.user.password).toBeUndefined();
});
