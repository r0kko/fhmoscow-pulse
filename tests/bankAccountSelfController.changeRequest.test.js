import { expect, jest, test, beforeEach } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const requestChangeMock = jest.fn();

jest.unstable_mockModule('../src/services/bankAccountChangeService.js', () => ({
  __esModule: true,
  default: { requestChange: requestChangeMock },
}));

const { default: controller } =
  await import('../src/controllers/bankAccountSelfController.js');

beforeEach(() => {
  requestChangeMock.mockReset();
  validationOk = true;
});

test('requestChange returns 400 on validation errors', async () => {
  validationOk = false;
  const req = { user: { id: 'u1' }, body: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.requestChange(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ errors: [{ msg: 'bad' }] });
});

test('requestChange returns 201 with created ticket+doc', async () => {
  requestChangeMock.mockResolvedValue({
    ticket: { id: 't1', number: '24-000001' },
    document: { id: 'd1' },
  });
  const req = {
    user: { id: 'u1' },
    body: { number: '40702810900000005555', bic: '044525225' },
  };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.requestChange(req, res);
  expect(requestChangeMock).toHaveBeenCalledWith(req.user, {
    number: req.body.number,
    bic: req.body.bic,
  });
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({
    ticket: { id: 't1', number: '24-000001' },
    document: { id: 'd1' },
  });
});

test('requestChange propagates service errors', async () => {
  requestChangeMock.mockRejectedValue({
    code: 'sign_type_simple_required',
    status: 400,
  });
  const req = {
    user: { id: 'u1' },
    body: { number: '40702810900000005555', bic: '044525225' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    set: jest.fn(),
  };
  await controller.requestChange(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'sign_type_simple_required' });
});
