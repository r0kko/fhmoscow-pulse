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
