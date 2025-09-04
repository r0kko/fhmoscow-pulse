import { expect, jest, test } from '@jest/globals';

// Mock validator to simulate weak password error
let validationOk = false;
let validationErrors = [{ path: 'password', msg: 'weak_password' }];

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => validationErrors,
  })),
}));

// Minimal mocks used in finish()
const findUserMock = jest.fn(async () => ({ id: 'u1' }));
jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findOne: findUserMock },
  ExternalSystem: {},
  UserExternalId: {},
}));

jest.unstable_mockModule('../src/services/emailVerificationService.js', () => ({
  __esModule: true,
  default: { verifyCode: jest.fn() },
}));
jest.unstable_mockModule('../src/services/sexService.js', () => ({
  __esModule: true,
  default: { getByAlias: jest.fn() },
}));
jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { resetPassword: jest.fn() },
}));
jest.unstable_mockModule('../src/services/addressService.js', () => ({
  __esModule: true,
  default: { fetchFromLegacy: jest.fn() },
}));
jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  __esModule: true,
  default: { fetchFromLegacy: jest.fn() },
}));
jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: { fetchFromLegacy: jest.fn() },
}));
jest.unstable_mockModule('../src/services/authService.js', () => ({
  __esModule: true,
  default: {
    issueTokens: jest.fn(() => ({ accessToken: 'a', refreshToken: 'r' })),
  },
}));
jest.unstable_mockModule('../src/utils/cookie.js', () => ({
  __esModule: true,
  setRefreshCookie: jest.fn(),
}));
jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (u) => ({ id: u.id }) },
}));

const { default: controller } = await import(
  '../src/controllers/registrationController.js'
);

function createRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

test('finish returns weak_password when password invalid', async () => {
  const req = {
    body: { email: 't@example.com', code: '123', password: 'weak' },
  };
  const res = createRes();
  await controller.finish(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'weak_password' });
  // reset for isolation
  validationOk = true;
  validationErrors = [{ msg: 'bad' }];
});
