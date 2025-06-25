import { expect, jest, test } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const createMock = jest.fn();
const toPublicMock = jest.fn(() => ({ id: 'n1' }));

jest.unstable_mockModule('../src/services/innService.js', () => ({
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

jest.unstable_mockModule('../src/mappers/innMapper.js', () => ({
  __esModule: true,
  default: { toPublic: toPublicMock },
}));

const { default: controller } = await import('../src/controllers/innController.js');

test('create returns 400 on validation errors', async () => {
  validationOk = false;
  const req = { user: { id: '1' }, body: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.create(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ errors: [{ msg: 'bad' }] });
  validationOk = true;
});

test('create stores new inn', async () => {
  createMock.mockResolvedValue({ id: 'n1' });
  const req = { user: { id: '1' }, body: { number: '123456789012' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.create(req, res);
  expect(createMock).toHaveBeenCalledWith('1', '123456789012', '1');
  expect(toPublicMock).toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ inn: { id: 'n1' } });
});

test('me returns legacy inn when not stored', async () => {
  const req = { user: { id: 'u1' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const service = await import('../src/services/innService.js');
  service.default.getByUser.mockResolvedValue(null);
  findOneExtMock.mockResolvedValue({ external_id: '20' });
  legacyFindMock.mockResolvedValue({ sv_inn: '123456789012' });
  await controller.me(req, res);
  expect(res.json).toHaveBeenCalledWith({ inn: { number: '123456789012' } });
});
