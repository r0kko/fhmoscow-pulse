import { expect, jest, test } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const createMock = jest.fn();
const removeMock = jest.fn();
const toPublicMock = jest.fn(() => ({ id: 'p1' }));

jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: { createForUser: createMock, removeByUser: removeMock },
}));

jest.unstable_mockModule('../src/mappers/passportMapper.js', () => ({
  __esModule: true,
  default: { toPublic: toPublicMock },
}));

const { default: controller } = await import(
  '../src/controllers/passportSelfController.js'
);

test('create returns 400 on validation errors', async () => {
  validationOk = false;
  const req = { user: { id: '1' }, body: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.create(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ errors: [{ msg: 'bad' }] });
  validationOk = true;
});

test('create stores new passport', async () => {
  createMock.mockResolvedValue({ id: 'p1' });
  const req = { user: { id: '1' }, body: { series: '11', number: '22' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.create(req, res);
  expect(createMock).toHaveBeenCalledWith(
    '1',
    { series: '11', number: '22' },
    '1'
  );
  expect(res.status).toHaveBeenCalledWith(201);
  expect(toPublicMock).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ passport: { id: 'p1' } });
});
