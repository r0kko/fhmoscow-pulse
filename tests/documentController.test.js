import { beforeEach, expect, jest, test } from '@jest/globals';

let validationOk = true;
let validationPayload = [{ msg: 'invalid', path: 'name' }];

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => validationPayload,
  })),
}));

const listByUserMock = jest.fn();
const listPendingSimpleMock = jest.fn();
const sendPendingCodeMock = jest.fn();
const signPendingMock = jest.fn();
const previewPendingMock = jest.fn();
const createMock = jest.fn();
const signMock = jest.fn();
const sendCodeMock = jest.fn();
const updateMock = jest.fn();
const removeMock = jest.fn();
const sendErrorMock = jest.fn();

jest.unstable_mockModule('../src/services/documentService.js', () => ({
  __esModule: true,
  default: {
    listByUser: listByUserMock,
    listPendingSimpleSignatures: listPendingSimpleMock,
    sendPendingSimpleSignatureCode: sendPendingCodeMock,
    signPendingSimpleSignatures: signPendingMock,
    previewPendingSimpleSignature: previewPendingMock,
    create: createMock,
    signWithCode: signMock,
    sendSignCode: sendCodeMock,
    update: updateMock,
    remove: removeMock,
  },
}));

jest.unstable_mockModule('../src/utils/api.js', () => ({
  __esModule: true,
  sendError: sendErrorMock,
}));

const { default: controller } =
  await import('../src/controllers/documentController.js');

beforeEach(() => {
  validationOk = true;
  validationPayload = [{ msg: 'invalid', path: 'name' }];
  listByUserMock.mockReset();
  listPendingSimpleMock.mockReset();
  sendPendingCodeMock.mockReset();
  signPendingMock.mockReset();
  previewPendingMock.mockReset();
  createMock.mockReset();
  signMock.mockReset();
  sendCodeMock.mockReset();
  updateMock.mockReset();
  removeMock.mockReset();
  sendErrorMock.mockReset();
});

test('list returns user documents', async () => {
  listByUserMock.mockResolvedValue(['doc']);
  const res = { json: jest.fn() };
  await controller.list({ user: { id: 'u1' } }, res);
  expect(listByUserMock).toHaveBeenCalledWith('u1');
  expect(res.json).toHaveBeenCalledWith({ documents: ['doc'] });
});

test('listPendingSignatures returns pending simple electronic documents', async () => {
  listPendingSimpleMock.mockResolvedValue(['doc']);
  const res = { json: jest.fn() };
  await controller.listPendingSignatures({ user: { id: 'u1' } }, res);
  expect(listPendingSimpleMock).toHaveBeenCalledWith('u1');
  expect(res.json).toHaveBeenCalledWith({ documents: ['doc'] });
});

test('sendPendingSignatureCode triggers service and handles error', async () => {
  const req = { user: { id: 'u1' } };
  const res = { json: jest.fn() };
  await controller.sendPendingSignatureCode(req, res);
  expect(sendPendingCodeMock).toHaveBeenCalledWith(req.user);
  expect(res.json).toHaveBeenCalledWith({ message: 'sent' });

  const err = new Error('fail');
  sendPendingCodeMock.mockRejectedValueOnce(err);
  await controller.sendPendingSignatureCode(req, res);
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});

test('signPendingSignatures forwards ids and code', async () => {
  signPendingMock.mockResolvedValue({
    signed_count: 2,
    failed: [],
    remaining_count: 0,
  });
  const req = {
    user: { id: 'u1' },
    body: { code: '123456', documentIds: ['d1', 'd2'] },
  };
  const res = { json: jest.fn() };
  await controller.signPendingSignatures(req, res);
  expect(signPendingMock).toHaveBeenCalledWith(
    req.user,
    ['d1', 'd2'],
    '123456'
  );
  expect(res.json).toHaveBeenCalledWith({
    signed_count: 2,
    failed: [],
    remaining_count: 0,
  });
});

test('previewPendingSignature streams inline pdf', async () => {
  const pdf = Buffer.from('%PDF-1.4');
  previewPendingMock.mockResolvedValue(pdf);
  const req = { user: { id: 'u1' }, params: { id: 'doc1' } };
  const res = {
    setHeader: jest.fn(),
    end: jest.fn(),
  };

  await controller.previewPendingSignature(req, res);

  expect(previewPendingMock).toHaveBeenCalledWith('u1', 'doc1');
  expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
  expect(res.setHeader).toHaveBeenCalledWith(
    'Content-Disposition',
    'inline; filename="document-preview.pdf"'
  );
  expect(res.end).toHaveBeenCalledWith(pdf);
});

test('create returns 400 on validation error', async () => {
  validationOk = false;
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.create({ user: { id: 'u1' }, body: {} }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ errors: validationPayload });
  expect(createMock).not.toHaveBeenCalled();
});

test('create passes payload with optional file', async () => {
  createMock.mockResolvedValue({ id: 'doc1' });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const file = { fieldname: 'file.pdf' };
  await controller.create(
    { user: { id: 'u1' }, body: { name: 'doc' }, file },
    res
  );
  expect(createMock).toHaveBeenCalledWith({ name: 'doc', file }, 'u1');
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ document: { id: 'doc1' } });
});

test('create delegates errors to sendError', async () => {
  const err = new Error('fail');
  createMock.mockRejectedValue(err);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.create({ user: { id: 'u1' }, body: {} }, res);
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});

test('sign forwards code and handles errors', async () => {
  const req = {
    user: { id: 'u1' },
    params: { id: 'doc2' },
    body: { code: '1234' },
  };
  const res = { json: jest.fn() };
  await controller.sign(req, res);
  expect(signMock).toHaveBeenCalledWith(req.user, 'doc2', '1234');
  expect(res.json).toHaveBeenCalledWith({ signed: true });

  const err = new Error('boom');
  signMock.mockRejectedValueOnce(err);
  await controller.sign(req, res);
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});

test('sendCode triggers service and handles error', async () => {
  const req = { user: { id: 'u1' }, params: { id: 'doc3' } };
  const res = { json: jest.fn() };
  await controller.sendCode(req, res);
  expect(sendCodeMock).toHaveBeenCalledWith(req.user, 'doc3');
  expect(res.json).toHaveBeenCalledWith({ message: 'sent' });

  const err = new Error('fail');
  sendCodeMock.mockRejectedValueOnce(err);
  await controller.sendCode(req, res);
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});

test('update validates input and returns updated doc', async () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  validationOk = false;
  await controller.update(
    { params: { id: 'doc4' }, body: {}, user: { id: 'u1' } },
    res
  );
  expect(res.status).toHaveBeenCalledWith(400);
  expect(updateMock).not.toHaveBeenCalled();

  validationOk = true;
  updateMock.mockResolvedValue({ id: 'doc4', name: 'updated' });
  await controller.update(
    { params: { id: 'doc4' }, body: { name: 'new' }, user: { id: 'u1' } },
    res
  );
  expect(updateMock).toHaveBeenCalledWith('doc4', { name: 'new' }, 'u1');
  expect(res.json).toHaveBeenCalledWith({
    document: { id: 'doc4', name: 'updated' },
  });
});

test('remove returns 204 or propagates errors', async () => {
  const status = jest.fn().mockReturnThis();
  const res = { status, end: jest.fn() };
  await controller.remove({ params: { id: 'doc5' }, user: { id: 'u1' } }, res);
  expect(removeMock).toHaveBeenCalledWith('doc5', 'u1');
  expect(status).toHaveBeenCalledWith(204);
  expect(res.end).toHaveBeenCalledWith();

  const err = new Error('oops');
  removeMock.mockRejectedValueOnce(err);
  await controller.remove({ params: { id: 'doc6' }, user: { id: 'u1' } }, res);
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});
