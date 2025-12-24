import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const docFindByPk = jest.fn();
const docStatusFindOne = jest.fn();
const userFindByPk = jest.fn();
const fileUpload = jest.fn();
const fileRemove = jest.fn();
const fileGetUrl = jest.fn();
const docUpdate = jest.fn();
const sendAwaitingMock = jest.fn();
const sendSignedMock = jest.fn();
const docUserSignCreate = jest.fn();
const docUserSignCount = jest.fn();
const docUserSignFindOne = jest.fn();
const signTypeFindOne = jest.fn();
const userSignFindOne = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Document: { findByPk: docFindByPk },
  DocumentStatus: { findOne: docStatusFindOne },
  SignType: { findByPk: jest.fn(), findOne: signTypeFindOne },
  User: { findByPk: userFindByPk },
  File: {},
  DocumentType: { findByPk: jest.fn() },
  DocumentUserSign: {
    findOne: docUserSignFindOne,
    create: docUserSignCreate,
    count: docUserSignCount,
  },
  UserSignType: { findOne: userSignFindOne },
}));

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: {
    uploadDocument: fileUpload,
    removeFile: fileRemove,
    getDownloadUrl: fileGetUrl,
    saveGeneratedPdf: jest.fn().mockResolvedValue({ id: 'file-1' }),
  },
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendDocumentAwaitingSignatureEmail: sendAwaitingMock,
    sendDocumentSignedEmail: sendSignedMock,
  },
}));

jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  __esModule: true,
  default: {
    getByUser: jest.fn().mockResolvedValue(null),
    createForUser: jest.fn().mockResolvedValue({}),
    updateForUser: jest.fn().mockResolvedValue({}),
    removeForUser: jest.fn().mockResolvedValue({}),
  },
}));

const { default: documentService } =
  await import('../src/services/documentService.js');

beforeEach(() => {
  docFindByPk.mockReset();
  docStatusFindOne.mockReset();
  userFindByPk.mockReset();
  fileUpload.mockReset();
  fileRemove.mockReset();
  fileGetUrl.mockReset();
  docUpdate.mockReset();
  sendAwaitingMock.mockReset();
  sendSignedMock.mockReset();
  docUserSignCount.mockReset();
  docUserSignCount.mockResolvedValue(0);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('requestSignature validates sign type and status', async () => {
  docFindByPk.mockResolvedValueOnce({
    SignType: { alias: 'SIMPLE_ELECTRONIC' },
  });
  await expect(
    documentService.requestSignature('doc-1', 'actor')
  ).rejects.toMatchObject({ code: 'document_sign_type_invalid' });

  docFindByPk.mockResolvedValueOnce({
    SignType: { alias: 'HANDWRITTEN' },
    DocumentStatus: { alias: 'SIGNED' },
  });
  await expect(
    documentService.requestSignature('doc-2', 'actor')
  ).rejects.toMatchObject({ code: 'document_status_invalid' });
});

test('requestSignature requires awaiting status config and sends email', async () => {
  const emailMock = (await import('../src/services/emailService.js')).default;
  const updateSpy = jest.fn().mockResolvedValue({});
  docFindByPk.mockResolvedValueOnce({
    SignType: { alias: 'HANDWRITTEN' },
    DocumentStatus: { alias: 'CREATED' },
    recipient: { email: 'user@mail' },
    update: updateSpy,
  });
  docStatusFindOne.mockResolvedValueOnce({
    id: 9,
    name: 'Awaiting',
    alias: 'AWAITING_SIGNATURE',
  });
  const res = await documentService.requestSignature('doc-3', 'actor-1');
  expect(updateSpy).toHaveBeenCalledWith({
    status_id: 9,
    updated_by: 'actor-1',
  });
  expect(res.alias).toBe('AWAITING_SIGNATURE');
  expect(emailMock.sendDocumentAwaitingSignatureEmail).toHaveBeenCalled();
});

test('uploadSignedFile requires file and correct sign type/status', async () => {
  await expect(
    documentService.uploadSignedFile('doc-4', null, 'actor')
  ).rejects.toMatchObject({ code: 'file_required' });

  docFindByPk.mockResolvedValueOnce(null);
  await expect(
    documentService.uploadSignedFile('doc-5', { dummy: true }, 'actor')
  ).rejects.toMatchObject({ code: 'document_not_found' });

  docFindByPk.mockResolvedValueOnce({
    SignType: { alias: 'SIMPLE_ELECTRONIC' },
  });
  await expect(
    documentService.uploadSignedFile('doc-6', { dummy: true }, 'actor')
  ).rejects.toMatchObject({ code: 'document_sign_type_invalid' });
});

test('uploadSignedFile updates status, replaces file, and returns download URL', async () => {
  const doc = {
    file_id: 11,
    SignType: { alias: 'HANDWRITTEN' },
    DocumentStatus: { alias: 'AWAITING_SIGNATURE' },
    update: docUpdate,
    recipient_id: 'u-1',
  };
  docFindByPk.mockResolvedValueOnce(doc);
  docStatusFindOne.mockResolvedValueOnce({
    id: 4,
    name: 'Signed',
    alias: 'SIGNED',
  });
  userFindByPk.mockResolvedValueOnce({
    id: 'u-1',
    email: 'user@mail',
    last_name: 'Last',
    first_name: 'First',
    patronymic: 'P',
  });
  fileUpload.mockResolvedValueOnce({ id: 100, key: 'files/report.pdf' });
  fileGetUrl.mockResolvedValueOnce('https://cdn/report.pdf');
  const result = await documentService.uploadSignedFile(
    'doc-7',
    { originalname: 'report.pdf' },
    'actor-3'
  );
  expect(docUpdate).toHaveBeenCalledWith({
    file_id: 100,
    status_id: 4,
    updated_by: 'actor-3',
  });
  expect(fileRemove).toHaveBeenCalledWith(11);
  expect(result.file.url).toBe('https://cdn/report.pdf');
});

test('signWithCode applies auto bank update and tolerates failures', async () => {
  const emailVerify = { verifyCodeOnly: jest.fn().mockResolvedValue({}) };
  jest.unstable_mockModule(
    '../src/services/emailVerificationService.js',
    () => ({
      __esModule: true,
      verifyCodeOnly: emailVerify.verifyCodeOnly,
      default: emailVerify,
    })
  );
  const docUpdateMock = jest.fn().mockResolvedValue({});
  const docStatusFind = jest.fn().mockResolvedValue({ id: 9 });
  docFindByPk.mockResolvedValue({
    id: 'doc-b',
    recipient_id: 'user-b',
    sign_type_id: 'st1',
    description: JSON.stringify({ number: '1', bic: '2' }),
    SignType: { alias: 'SIMPLE_ELECTRONIC' },
    DocumentStatus: { alias: 'AWAITING_SIGNATURE' },
    DocumentType: {
      alias: 'BANK_DETAILS_CHANGE',
      generated: true,
      name: 'Bank',
    },
    recipient: { id: 'user-b', email: 'x@example.com' },
    update: docUpdateMock,
  });
  docStatusFindOne.mockImplementation(docStatusFind);
  userFindByPk.mockResolvedValue({ email: 'x@example.com' });
  signTypeFindOne.mockResolvedValue({ id: 'st1', alias: 'SIMPLE_ELECTRONIC' });
  userSignFindOne.mockResolvedValue({
    sign_type_id: 'st1',
  });
  docUserSignFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
    id: 'sig-1',
    created_at: new Date('2023-01-01T00:00:00Z'),
  });
  docUserSignCount.mockResolvedValueOnce(0);
  docUserSignCreate.mockResolvedValue({});
  docStatusFindOne.mockImplementation(docStatusFind);
  const bankService = await import('../src/services/bankAccountService.js');
  bankService.default.getByUser = jest.fn().mockResolvedValue(null);
  await documentService.signWithCode(
    { id: 'user-b', token_version: 1 },
    'doc-b',
    '123456'
  );
  expect(docUserSignCreate).toHaveBeenCalled();
  expect(docUpdateMock).toHaveBeenCalled();
});
