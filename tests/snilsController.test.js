import { expect, jest, test } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const createMock = jest.fn();
const toPublicMock = jest.fn(() => ({ id: 's1' }));

jest.unstable_mockModule('../src/services/snilsService.js', () => ({
  __esModule: true,
  default: { create: createMock, getByUser: jest.fn() },
}));

const findOneExtMock = jest.fn();
const legacyFindMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  UserExternalId: { findOne: findOneExtMock },
}));

jest.unstable_mockModule('../src/services/legacyUserService.js', () => ({
  __esModule: true,
  default: { findById: legacyFindMock },
}));

jest.unstable_mockModule('../src/mappers/snilsMapper.js', () => ({
  __esModule: true,
  default: { toPublic: toPublicMock },
}));

const { default: controller } = await import('../src/controllers/snilsController.js');

test('create returns 400 on validation errors', async () => {
  validationOk = false;
  const req = { user: { id: '1' }, body: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.create(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ errors: [{ msg: 'bad' }] });
  validationOk = true;
});

test('create stores new snils', async () => {
  createMock.mockResolvedValue({ id: 's1' });
  const req = { user: { id: '1' }, body: { number: '123-456-789 00' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.create(req, res);
  expect(createMock).toHaveBeenCalledWith('1', '123-456-789 00', '1');
  expect(toPublicMock).toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ snils: { id: 's1' } });
});

test('me returns legacy snils when not stored', async () => {
  const req = { user: { id: 'u1' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const service = await import('../src/services/snilsService.js');
  service.default.getByUser.mockResolvedValue(null);
  findOneExtMock.mockResolvedValue({ external_id: '10' });
  legacyFindMock.mockResolvedValue({ sv_ops: '111-222-333 44' });
  await controller.me(req, res);
  expect(res.json).toHaveBeenCalledWith({ snils: { number: '111-222-333 44' } });
});
