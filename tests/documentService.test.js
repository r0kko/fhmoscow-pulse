import { jest, expect, test, beforeEach } from '@jest/globals';

const createMock = jest.fn();
const findByPkMock = jest.fn();
const findOneStatusMock = jest.fn();
const countMock = jest.fn();
const findOneSignMock = jest.fn();
const createSignMock = jest.fn();
const findUserByPkMock = jest.fn();
const findUserSignTypeMock = jest.fn();
const uploadDocumentMock = jest.fn();
const getDownloadUrlMock = jest.fn();
const removeFileMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Document: { create: createMock, findByPk: findByPkMock },
  DocumentStatus: { findOne: findOneStatusMock },
  DocumentUserSign: { count: countMock, findOne: findOneSignMock, create: createSignMock },
  UserSignType: { findOne: findUserSignTypeMock },
  User: { findByPk: findUserByPkMock },
  SignType: {},
  DocumentType: {},
  File: {},
  MedicalCertificate: {},
  MedicalCertificateFile: {},
  MedicalCertificateType: {},
}));

const sendCreatedEmailMock = jest.fn();
const sendSignedEmailMock = jest.fn();
const sendAwaitingEmailMock = jest.fn();

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendDocumentCreatedEmail: sendCreatedEmailMock,
    sendDocumentSignedEmail: sendSignedEmailMock,
    sendDocumentAwaitingSignatureEmail: sendAwaitingEmailMock,
  },
}));

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: {
    uploadDocument: uploadDocumentMock,
    getDownloadUrl: getDownloadUrlMock,
    removeFile: removeFileMock,
    saveGeneratedPdf: jest.fn(),
  },
}));

const { default: service } = await import('../src/services/documentService.js');

beforeEach(() => {
  createMock.mockReset();
  findByPkMock.mockReset();
  findOneStatusMock.mockReset();
  countMock.mockReset();
  findOneSignMock.mockReset();
  createSignMock.mockReset();
  findUserByPkMock.mockReset();
  findUserSignTypeMock.mockReset();
  sendCreatedEmailMock.mockReset();
  sendSignedEmailMock.mockReset();
  sendAwaitingEmailMock.mockReset();
  findOneStatusMock.mockImplementation(({ where: { alias } }) =>
    Promise.resolve({ id: alias, name: alias, alias })
  );
  findUserByPkMock.mockResolvedValue({
    id: 'u1',
    email: 'user@example.com',
    last_name: 'L',
    first_name: 'F',
    patronymic: 'P',
  });
});

test('create sends document created email to recipient', async () => {
  createMock.mockResolvedValue({
    id: 'd1',
    name: 'Doc',
    recipient_id: 'u1',
    number: '25.08/1',
  });

  await service.create(
    { recipientId: 'u1', documentTypeId: 't1', signTypeId: 's1', name: 'Doc' },
    'adm'
  );

  expect(sendCreatedEmailMock).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'user@example.com' }),
    expect.objectContaining({ id: 'd1', name: 'Doc', number: '25.08/1' })
  );
});

test('sign sends document signed email', async () => {
  findByPkMock.mockResolvedValue({
    id: 'd1',
    sign_type_id: 's1',
    recipient_id: 'u1',
    update: jest.fn(),
    number: '25.08/1',
  });
  countMock.mockResolvedValue(0);
  findOneSignMock.mockResolvedValue(null);
  findUserSignTypeMock.mockResolvedValue({ user_id: 'u1', sign_type_id: 's1' });
  createSignMock.mockResolvedValue({});

  await service.sign({ id: 'u1' }, 'd1');

  expect(sendSignedEmailMock).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'user@example.com' }),
    expect.objectContaining({ id: 'd1', number: '25.08/1' })
  );
});

test('create skips email when recipient missing address', async () => {
  findUserByPkMock.mockResolvedValueOnce({ id: 'u1' });
  createMock.mockResolvedValueOnce({
    id: 'd2',
    name: 'Doc2',
    recipient_id: 'u1',
     number: '25.08/2',
  });

  await service.create(
    { recipientId: 'u1', documentTypeId: 't1', signTypeId: 's1', name: 'Doc2' },
    'adm'
  );

  expect(sendCreatedEmailMock).not.toHaveBeenCalled();
});

test('requestSignature sends awaiting signature email', async () => {
  findByPkMock.mockResolvedValueOnce({
    id: 'd1',
    SignType: { alias: 'HANDWRITTEN', name: 'Hand' },
    recipient: {
      email: 'user@example.com',
      last_name: 'L',
      first_name: 'F',
      patronymic: 'P',
    },
    DocumentStatus: { alias: 'CREATED' },
    update: jest.fn(),
    number: '25.08/3',
  });

  await service.requestSignature('d1', 'adm');

  expect(sendAwaitingEmailMock).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'user@example.com' }),
    expect.objectContaining({ id: 'd1', number: '25.08/3' })
  );
});

test('uploadSignedFile updates document and notifies recipient', async () => {
  findByPkMock.mockResolvedValueOnce({
    id: 'd1',
    SignType: { alias: 'HANDWRITTEN' },
    DocumentStatus: { alias: 'AWAITING_SIGNATURE' },
    recipient_id: 'u1',
    file_id: 'old',
    update: jest.fn(),
    number: '25.08/4',
  });
  uploadDocumentMock.mockResolvedValue({ id: 'new' });
  getDownloadUrlMock.mockResolvedValue('url');

  await service.uploadSignedFile('d1', { path: 'f.pdf' }, 'adm');

  expect(uploadDocumentMock).toHaveBeenCalled();
  expect(removeFileMock).toHaveBeenCalledWith('old');
  expect(sendSignedEmailMock).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'user@example.com' }),
    expect.objectContaining({ id: 'd1', number: '25.08/4' })
  );
});
