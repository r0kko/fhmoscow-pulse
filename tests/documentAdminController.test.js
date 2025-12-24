import { beforeEach, expect, jest, test } from '@jest/globals';

const listAllMock = jest.fn();
const consentMock = jest.fn();
const requestSignatureMock = jest.fn();
const uploadSignedMock = jest.fn();
const regenerateMock = jest.fn();
const sendErrorMock = jest.fn();

jest.unstable_mockModule('../src/services/documentService.js', () => ({
  __esModule: true,
  default: {
    listAll: listAllMock,
    generatePersonalDataConsent: consentMock,
    requestSignature: requestSignatureMock,
    uploadSignedFile: uploadSignedMock,
    regenerate: regenerateMock,
  },
}));

jest.unstable_mockModule('../src/utils/api.js', () => ({
  __esModule: true,
  sendError: sendErrorMock,
}));

const { default: controller } =
  await import('../src/controllers/documentAdminController.js');

beforeEach(() => {
  listAllMock.mockReset();
  consentMock.mockReset();
  requestSignatureMock.mockReset();
  uploadSignedMock.mockReset();
  regenerateMock.mockReset();
  sendErrorMock.mockReset();
});

test('list returns documents payload', async () => {
  listAllMock.mockResolvedValue([{ id: 'd1' }]);
  const res = { json: jest.fn() };
  await controller.list({}, res);
  expect(listAllMock).toHaveBeenCalledTimes(1);
  expect(res.json).toHaveBeenCalledWith({ documents: [{ id: 'd1' }] });
});

test('list forwards errors via sendError', async () => {
  const err = new Error('boom');
  listAllMock.mockRejectedValue(err);
  const res = {};
  await controller.list({}, res);
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});

test('downloadConsent responds with pdf download headers', async () => {
  const pdf = Buffer.from('pdf');
  consentMock.mockResolvedValue(pdf);
  const res = {
    setHeader: jest.fn(),
    end: jest.fn(),
  };
  await controller.downloadConsent({ params: { id: 'doc1' } }, res);
  expect(consentMock).toHaveBeenCalledWith('doc1');
  expect(res.setHeader).toHaveBeenNthCalledWith(
    1,
    'Content-Type',
    'application/pdf'
  );
  expect(res.setHeader).toHaveBeenNthCalledWith(
    2,
    'Content-Disposition',
    'attachment; filename="consent.pdf"'
  );
  expect(res.end).toHaveBeenCalledWith(pdf);
});

test('downloadConsent sends 404 when generation fails', async () => {
  const res = { setHeader: jest.fn(), end: jest.fn() };
  const err = new Error('nope');
  consentMock.mockRejectedValue(err);
  await controller.downloadConsent({ params: { id: 'doc2' } }, res);
  expect(sendErrorMock).toHaveBeenCalledWith(res, err, 404);
});

test('requestSignature forwards status', async () => {
  requestSignatureMock.mockResolvedValue('queued');
  const res = { json: jest.fn() };
  const req = { params: { id: 'doc3' }, user: { id: 'admin' } };
  await controller.requestSignature(req, res);
  expect(requestSignatureMock).toHaveBeenCalledWith('doc3', 'admin');
  expect(res.json).toHaveBeenCalledWith({ status: 'queued' });
});

test('requestSignature delegates errors', async () => {
  const res = { json: jest.fn() };
  const err = new Error('boom');
  requestSignatureMock.mockRejectedValue(err);
  await controller.requestSignature(
    { params: { id: 'd' }, user: { id: 1 } },
    res
  );
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});

test('uploadSigned returns result payload', async () => {
  uploadSignedMock.mockResolvedValue({ ok: true });
  const res = { json: jest.fn() };
  const req = {
    params: { id: 'doc4' },
    user: { id: 'admin' },
    file: { originalname: 'file.pdf' },
  };
  await controller.uploadSigned(req, res);
  expect(uploadSignedMock).toHaveBeenCalledWith('doc4', req.file, 'admin');
  expect(res.json).toHaveBeenCalledWith({ ok: true });
});

test('regenerate proxies service result', async () => {
  regenerateMock.mockResolvedValue({ refreshed: true });
  const res = { json: jest.fn() };
  await controller.regenerate(
    { params: { id: 'doc5' }, user: { id: 'admin' } },
    res
  );
  expect(regenerateMock).toHaveBeenCalledWith('doc5', 'admin');
  expect(res.json).toHaveBeenCalledWith({ refreshed: true });
});
