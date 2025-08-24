import { expect, jest, test } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const createMock = jest.fn();

jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: { createForUser: createMock },
}));
jest.unstable_mockModule('../src/mappers/passportMapper.js', () => ({
  __esModule: true,
  default: { toPublic: jest.fn() },
}));

const { default: controller } = await import('../src/controllers/passportSelfController.js');

test('create returns 400 when service throws', async () => {
  createMock.mockRejectedValue(new Error('db_error'));
  const req = { user: { id: 'u1' }, body: { series: '11', number: '22' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.create(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'db_error' });
});

