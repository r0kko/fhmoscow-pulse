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
