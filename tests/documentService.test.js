import { jest, expect, test, beforeEach } from '@jest/globals';

const createMock = jest.fn();
const findByPkMock = jest.fn();
const findAllMock = jest.fn();
const docCountMock = jest.fn();
const findOneStatusMock = jest.fn();
const countMock = jest.fn();
const findOneSignMock = jest.fn();
const createSignMock = jest.fn();
const findUserByPkMock = jest.fn();
const findUserSignTypeMock = jest.fn();
const findDocTypeByPkMock = jest.fn();
const findSignTypeMock = jest.fn();
const destroyUserSignMock = jest.fn();
const createUserSignTypeMock = jest.fn();
const uploadDocumentMock = jest.fn();
const getDownloadUrlMock = jest.fn();
const removeFileMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Document: {
    create: createMock,
    findByPk: findByPkMock,
    findAll: findAllMock,
    count: docCountMock,
  },
  DocumentStatus: { findOne: findOneStatusMock },
  DocumentUserSign: {
    count: countMock,
    findOne: findOneSignMock,
    create: createSignMock,
  },
  UserSignType: {
    findOne: findUserSignTypeMock,
    destroy: destroyUserSignMock,
    create: createUserSignTypeMock,
  },
  User: { findByPk: findUserByPkMock },
  SignType: { findOne: findSignTypeMock },
  DocumentType: { findByPk: findDocTypeByPkMock },
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

const sendCodeMock = jest.fn();

jest.unstable_mockModule('../src/services/emailVerificationService.js', () => ({
  __esModule: true,
  default: { sendCode: sendCodeMock },
  sendCode: sendCodeMock,
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
  findAllMock.mockReset();
  docCountMock.mockReset();
  findOneStatusMock.mockReset();
  countMock.mockReset();
  findOneSignMock.mockReset();
  createSignMock.mockReset();
  findUserByPkMock.mockReset();
  findUserSignTypeMock.mockReset();
  findDocTypeByPkMock.mockReset();
  findSignTypeMock.mockReset();
  destroyUserSignMock.mockReset();
  createUserSignTypeMock.mockReset();
  sendCreatedEmailMock.mockReset();
  sendSignedEmailMock.mockReset();
  sendAwaitingEmailMock.mockReset();
  sendCodeMock.mockReset();
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
  findDocTypeByPkMock.mockResolvedValue({ alias: 'OTHER' });
});

test('countPendingSimpleSignatures counts awaiting simple electronic documents', async () => {
  docCountMock.mockResolvedValueOnce(3);
  await expect(service.countPendingSimpleSignatures('u1')).resolves.toBe(3);
  expect(docCountMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { recipient_id: 'u1' },
      include: expect.arrayContaining([
        expect.objectContaining({
          required: true,
          where: { alias: 'SIMPLE_ELECTRONIC' },
        }),
        expect.objectContaining({
          required: true,
          where: { alias: 'AWAITING_SIGNATURE' },
        }),
      ]),
    })
  );
});

test('listPendingSimpleSignatures returns mapped pending documents', async () => {
  getDownloadUrlMock.mockResolvedValueOnce('https://cdn/doc.pdf');
  findAllMock.mockResolvedValueOnce([
    {
      id: 'd1',
      number: '26.04/1',
      name: 'Документ',
      description: null,
      document_date: new Date('2026-04-01T00:00:00Z'),
      DocumentType: {
        name: 'Тип',
        alias: 'TYPE',
        generated: true,
      },
      SignType: { name: 'ПЭП', alias: 'SIMPLE_ELECTRONIC' },
      DocumentStatus: {
        name: 'Ожидает подписи',
        alias: 'AWAITING_SIGNATURE',
      },
      File: { id: 'f1', key: 'documents/doc.pdf' },
    },
  ]);

  const docs = await service.listPendingSimpleSignatures('u1');

  expect(findAllMock).toHaveBeenCalledWith(
    expect.objectContaining({ where: { recipient_id: 'u1' } })
  );
  expect(docs).toEqual([
    expect.objectContaining({
      id: 'd1',
      file: { id: 'f1', url: 'https://cdn/doc.pdf' },
      signType: { name: 'ПЭП', alias: 'SIMPLE_ELECTRONIC' },
      status: { name: 'Ожидает подписи', alias: 'AWAITING_SIGNATURE' },
    }),
  ]);
});

test('sendPendingSimpleSignatureCode rejects when nothing awaits signature', async () => {
  docCountMock.mockResolvedValueOnce(0);
  await expect(
    service.sendPendingSimpleSignatureCode({ id: 'u1' })
  ).rejects.toMatchObject({
    code: 'pending_signature_documents_not_found',
    status: 404,
  });
  expect(sendCodeMock).not.toHaveBeenCalled();
});

test('sendPendingSimpleSignatureCode sends one batch code', async () => {
  docCountMock.mockResolvedValueOnce(2);
  await service.sendPendingSimpleSignatureCode({ id: 'u1', email: 'u@mail' });
  expect(sendCodeMock).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'u1' }),
    'doc-sign',
    { document: { name: 'Пакет документов к подписанию (2)' } }
  );
});

test('previewPendingSimpleSignature renders awaiting generated simple document', async () => {
  findByPkMock.mockResolvedValueOnce({
    id: 'd1',
    recipient_id: 'u1',
    number: '26.04/1',
    name: 'Заявление',
    description: null,
    document_date: new Date('2026-04-01T00:00:00Z'),
    DocumentType: {
      name: 'Заявление',
      alias: 'REFEREE_CONTRACT_APPLICATION',
      generated: true,
    },
    DocumentStatus: { alias: 'AWAITING_SIGNATURE' },
    SignType: { alias: 'SIMPLE_ELECTRONIC' },
    recipient: {
      id: 'u1',
      last_name: 'Иванов',
      first_name: 'Иван',
      patronymic: 'Иванович',
      birth_date: '1990-01-01',
    },
  });

  const pdf = await service.previewPendingSimpleSignature('u1', 'd1');

  expect(Buffer.isBuffer(pdf)).toBe(true);
  expect(pdf.length).toBeGreaterThan(0);
});

test('previewPendingSimpleSignature rejects wrong recipient', async () => {
  findByPkMock.mockResolvedValueOnce({
    id: 'd1',
    recipient_id: 'u2',
    DocumentType: { generated: true, alias: 'OTHER' },
    DocumentStatus: { alias: 'AWAITING_SIGNATURE' },
    SignType: { alias: 'SIMPLE_ELECTRONIC' },
  });

  await expect(
    service.previewPendingSimpleSignature('u1', 'd1')
  ).rejects.toMatchObject({ code: 'forbidden', status: 403 });
});

test('create sends document created email to recipient', async () => {
  createMock.mockResolvedValue({
    id: 'd1',
    name: 'Doc',
    recipient_id: 'u1',
    number: '25.08/1',
  });

  await service.create(
    {
      recipientId: 'u1',
      documentTypeId: 't1',
      signTypeId: 's1',
      name: 'Doc',
      fileId: 'f1',
    },
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

test('sign assigns simple electronic sign type after agreement', async () => {
  findByPkMock.mockResolvedValue({
    id: 'd1',
    sign_type_id: 's1',
    document_type_id: 'dt1',
    recipient_id: 'u1',
    update: jest.fn(),
    number: '25.08/5',
  });
  countMock.mockResolvedValue(0);
  findOneSignMock.mockResolvedValue(null);
  findUserSignTypeMock.mockResolvedValue({ user_id: 'u1', sign_type_id: 's1' });
  findDocTypeByPkMock.mockResolvedValue({
    alias: 'ELECTRONIC_INTERACTION_AGREEMENT',
  });
  findSignTypeMock.mockResolvedValue({ id: 'simple-id' });
  createSignMock.mockResolvedValue({});

  await service.sign({ id: 'u1' }, 'd1');

  expect(destroyUserSignMock).toHaveBeenCalledWith({
    where: { user_id: 'u1' },
  });
  expect(createUserSignTypeMock).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'u1', sign_type_id: 'simple-id' })
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
    {
      recipientId: 'u1',
      documentTypeId: 't1',
      signTypeId: 's1',
      name: 'Doc2',
      fileId: 'f1',
    },
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

test('createContractApplicationDocument sets AWAITING_SIGNATURE and emails recipient', async () => {
  // Mock dependencies
  findUserByPkMock.mockResolvedValueOnce({
    id: 'u1',
    email: 'user@example.com',
    last_name: 'L',
    first_name: 'F',
    patronymic: 'P',
  });
  // DocumentType
  const findDocType = jest.fn().mockResolvedValue({
    id: 'type1',
    name: 'REFEREE_CONTRACT',
    alias: 'REFEREE_CONTRACT_APPLICATION',
    generated: true,
  });
  // Swap DocumentType.findOne for this test
  const { DocumentType } = await import('../src/models/index.js');
  DocumentType.findOne = findDocType;

  // Status AWAITING_SIGNATURE
  findOneStatusMock.mockImplementation(({ where: { alias } }) =>
    Promise.resolve({ id: alias, name: alias, alias })
  );

  // Sign type: SIMPLE_ELECTRONIC
  findUserSignTypeMock.mockResolvedValueOnce({
    user_id: 'u1',
    SignType: { id: 'sign1', alias: 'SIMPLE_ELECTRONIC' },
  });

  // File save
  const { default: fileService } =
    await import('../src/services/fileService.js');
  fileService.saveGeneratedPdf = jest
    .fn()
    .mockResolvedValue({ id: 'file1', key: 'k' });

  // Document.create
  createMock.mockResolvedValueOnce({
    id: 'doc1',
    name: 'REFEREE_CONTRACT',
    number: '25.09/1',
  });
  // FindByPk after regenerate
  findByPkMock.mockResolvedValueOnce({
    id: 'doc1',
    number: '25.09/1',
    name: 'REFEREE_CONTRACT',
    DocumentType: {
      name: 'REFEREE_CONTRACT',
      alias: 'REFEREE_CONTRACT_APPLICATION',
      generated: true,
    },
    SignType: { name: 'Простая ЭП', alias: 'SIMPLE_ELECTRONIC' },
  });

  const { default: service } =
    await import('../src/services/documentService.js');
  const res = await service.createContractApplicationDocument('u1', 'adm');

  expect(res.document.status).toEqual({
    name: 'AWAITING_SIGNATURE',
    alias: 'AWAITING_SIGNATURE',
  });
  expect(sendAwaitingEmailMock).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'user@example.com' }),
    expect.objectContaining({
      id: 'doc1',
      number: '25.09/1',
      name: 'REFEREE_CONTRACT',
    })
  );
});
