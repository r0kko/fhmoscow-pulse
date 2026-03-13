import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const docFindByPk = jest.fn();
const docStatusFindOne = jest.fn();
const docTypeFindByPk = jest.fn();
const userFindByPk = jest.fn();
const fileUpload = jest.fn();
const fileRemove = jest.fn();
const fileGetUrl = jest.fn();
const saveGeneratedPdf = jest.fn();
const docUpdate = jest.fn();
const sendAwaitingMock = jest.fn();
const sendSignedMock = jest.fn();
const docUserSignCreate = jest.fn();
const docUserSignCount = jest.fn();
const docUserSignFindOne = jest.fn();
const docUserSignFindAll = jest.fn();
const docUserSignDestroy = jest.fn();
const signTypeFindOne = jest.fn();
const userSignFindOne = jest.fn();
const closingActBuilder = jest.fn();
const closingActCanceledMock = jest.fn();
const handleRecipientSignedMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Document: { findByPk: docFindByPk },
  DocumentStatus: { findOne: docStatusFindOne },
  SignType: { findByPk: jest.fn(), findOne: signTypeFindOne },
  User: { findByPk: userFindByPk },
  File: {},
  DocumentType: { findByPk: docTypeFindByPk },
  DocumentUserSign: {
    findOne: docUserSignFindOne,
    findAll: docUserSignFindAll,
    destroy: docUserSignDestroy,
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
    saveGeneratedPdf,
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

jest.unstable_mockModule(
  '../src/services/docBuilders/refereeClosingAct.js',
  () => ({
    __esModule: true,
    default: closingActBuilder,
  })
);

jest.unstable_mockModule(
  '../src/services/refereeClosingDocumentService.js',
  () => ({
    __esModule: true,
    default: {
      isClosingDocumentCanceled: closingActCanceledMock,
      handleRecipientSigned: handleRecipientSignedMock,
    },
  })
);

const { default: documentService } =
  await import('../src/services/documentService.js');

beforeEach(() => {
  docFindByPk.mockReset();
  docStatusFindOne.mockReset();
  docTypeFindByPk.mockReset();
  userFindByPk.mockReset();
  fileUpload.mockReset();
  fileRemove.mockReset();
  fileGetUrl.mockReset();
  saveGeneratedPdf.mockReset();
  saveGeneratedPdf.mockResolvedValue({ id: 'file-1' });
  docUpdate.mockReset();
  sendAwaitingMock.mockReset();
  sendSignedMock.mockReset();
  docUserSignCount.mockReset();
  docUserSignCount.mockResolvedValue(0);
  docUserSignFindOne.mockReset();
  docUserSignFindAll.mockReset();
  docUserSignDestroy.mockReset();
  docUserSignCreate.mockReset();
  signTypeFindOne.mockReset();
  userSignFindOne.mockReset();
  closingActBuilder.mockReset();
  closingActBuilder.mockResolvedValue(Buffer.from('pdf'));
  closingActCanceledMock.mockReset();
  closingActCanceledMock.mockResolvedValue(false);
  handleRecipientSignedMock.mockReset();
  handleRecipientSignedMock.mockResolvedValue(undefined);
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

test('sign keeps closing act awaiting after FHMO signature', async () => {
  const updateMock = jest.fn().mockResolvedValue({});
  const doc = {
    id: 'doc-closing-1',
    recipient_id: 'ref-1',
    sign_type_id: 'sign-1',
    document_type_id: 'type-1',
    SignType: { alias: 'SIMPLE_ELECTRONIC', name: 'ПЭП' },
    DocumentType: { alias: 'REFEREE_CLOSING_ACT' },
    DocumentStatus: { alias: 'CREATED' },
    get: jest.fn().mockReturnValue({ id: 'doc-closing-1' }),
    update: updateMock,
  };

  docFindByPk.mockResolvedValue(doc);
  docUserSignCount.mockResolvedValue(0);
  docUserSignFindOne.mockResolvedValue(null);
  userSignFindOne.mockResolvedValue({ sign_type_id: 'sign-1' });
  docStatusFindOne.mockImplementation(({ where }) => {
    if (where.alias === 'SIGNED') return Promise.resolve({ id: 10 });
    if (where.alias === 'AWAITING_SIGNATURE')
      return Promise.resolve({ id: 20 });
    return Promise.resolve(null);
  });
  userFindByPk.mockResolvedValue({
    id: 'ref-1',
    email: 'ref@example.com',
    last_name: 'Рефери',
    first_name: 'Иван',
    patronymic: 'Иванович',
  });
  docTypeFindByPk.mockResolvedValue({ alias: 'REFEREE_CLOSING_ACT' });

  await documentService.sign({ id: 'fhmo-1' }, 'doc-closing-1');

  expect(docUserSignCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      document_id: 'doc-closing-1',
      user_id: 'fhmo-1',
    })
  );
  expect(updateMock).toHaveBeenCalledWith({
    status_id: 20,
    updated_by: 'fhmo-1',
  });
  expect(sendAwaitingMock).toHaveBeenCalledTimes(1);
  expect(sendSignedMock).not.toHaveBeenCalled();
});

test('sign can defer awaiting notification for closing act until PDF regeneration succeeds', async () => {
  const updateMock = jest.fn().mockResolvedValue({});
  const doc = {
    id: 'doc-closing-deferred',
    recipient_id: 'ref-1',
    sign_type_id: 'sign-1',
    document_type_id: 'type-1',
    SignType: { alias: 'SIMPLE_ELECTRONIC', name: 'ПЭП' },
    DocumentType: { alias: 'REFEREE_CLOSING_ACT' },
    DocumentStatus: { alias: 'CREATED' },
    get: jest.fn().mockReturnValue({ id: 'doc-closing-deferred' }),
    update: updateMock,
  };

  docFindByPk.mockResolvedValue(doc);
  docUserSignCount.mockResolvedValue(0);
  docUserSignFindOne.mockResolvedValue(null);
  userSignFindOne.mockResolvedValue({ sign_type_id: 'sign-1' });
  docStatusFindOne.mockImplementation(({ where }) => {
    if (where.alias === 'SIGNED') return Promise.resolve({ id: 10 });
    if (where.alias === 'AWAITING_SIGNATURE')
      return Promise.resolve({ id: 20 });
    return Promise.resolve(null);
  });
  docTypeFindByPk.mockResolvedValue({ alias: 'REFEREE_CLOSING_ACT' });

  await documentService.sign({ id: 'fhmo-1' }, 'doc-closing-deferred', {
    notify: false,
  });

  expect(updateMock).toHaveBeenCalledWith({
    status_id: 20,
    updated_by: 'fhmo-1',
  });
  expect(sendAwaitingMock).not.toHaveBeenCalled();
  expect(sendSignedMock).not.toHaveBeenCalled();
});

test('sign completes closing act after referee signature', async () => {
  const updateMock = jest.fn().mockResolvedValue({});
  docFindByPk.mockResolvedValue({
    id: 'doc-closing-2',
    recipient_id: 'ref-2',
    sign_type_id: 'sign-1',
    document_type_id: 'type-1',
    SignType: { alias: 'SIMPLE_ELECTRONIC', name: 'ПЭП' },
    DocumentType: { alias: 'REFEREE_CLOSING_ACT' },
    DocumentStatus: { alias: 'AWAITING_SIGNATURE' },
    get: jest.fn().mockReturnValue({ id: 'doc-closing-2' }),
    update: updateMock,
  });
  docUserSignCount.mockResolvedValue(1);
  docUserSignFindOne.mockResolvedValue(null);
  userSignFindOne.mockResolvedValue({ sign_type_id: 'sign-1' });
  docStatusFindOne.mockImplementation(({ where }) => {
    if (where.alias === 'SIGNED') return Promise.resolve({ id: 10 });
    if (where.alias === 'AWAITING_SIGNATURE')
      return Promise.resolve({ id: 20 });
    return Promise.resolve(null);
  });
  userFindByPk.mockResolvedValue({
    id: 'ref-2',
    email: 'ref2@example.com',
    last_name: 'Судья',
    first_name: 'Петр',
    patronymic: 'Петрович',
  });
  docTypeFindByPk.mockResolvedValue({ alias: 'REFEREE_CLOSING_ACT' });

  await documentService.sign({ id: 'ref-2' }, 'doc-closing-2');

  expect(updateMock).toHaveBeenCalledWith({
    status_id: 10,
    updated_by: 'ref-2',
  });
  expect(sendSignedMock).toHaveBeenCalledTimes(1);
  expect(sendAwaitingMock).not.toHaveBeenCalled();
});

test('signWithCode rolls closing act signature back when regenerate fails', async () => {
  const emailVerify = { verifyCodeOnly: jest.fn().mockResolvedValue({}) };
  jest.unstable_mockModule(
    '../src/services/emailVerificationService.js',
    () => ({
      __esModule: true,
      verifyCodeOnly: emailVerify.verifyCodeOnly,
      default: emailVerify,
    })
  );
  const signDocUpdate = jest.fn().mockResolvedValue({});
  const rollbackDocUpdate = jest.fn().mockResolvedValue({});
  docFindByPk
    .mockResolvedValueOnce({
      id: 'doc-closing-code-1',
      recipient_id: 'ref-2',
      sign_type_id: 'sign-1',
      document_type_id: 'type-1',
      SignType: { alias: 'SIMPLE_ELECTRONIC', id: 'sign-1' },
      DocumentStatus: {
        alias: 'AWAITING_SIGNATURE',
        name: 'Ожидает подписи',
        id: 20,
      },
      DocumentType: {
        alias: 'REFEREE_CLOSING_ACT',
        generated: true,
        name: 'Акт',
      },
      recipient: { id: 'ref-2', email: 'ref2@example.com' },
      update: signDocUpdate,
    })
    .mockResolvedValueOnce({
      id: 'doc-closing-code-1',
      recipient_id: 'ref-2',
      sign_type_id: 'sign-1',
      document_type_id: 'type-1',
      SignType: { alias: 'SIMPLE_ELECTRONIC', name: 'ПЭП' },
      DocumentType: { alias: 'REFEREE_CLOSING_ACT' },
      DocumentStatus: { alias: 'AWAITING_SIGNATURE' },
      get: jest.fn().mockReturnValue({ id: 'doc-closing-code-1' }),
      update: signDocUpdate,
    })
    .mockResolvedValueOnce({
      id: 'doc-closing-code-1',
      name: 'Акт',
      number: '26.03/1001',
      document_date: new Date('2026-03-13T00:00:00Z'),
      file_id: 14,
      recipient_id: 'ref-2',
      description: JSON.stringify({
        kind: 'REFEREE_CLOSING_ACT',
        payload: {
          customer: { name: 'ФХМ' },
          performer: { full_name: 'Судья', address: 'Москва' },
          contract: { number: '26.03/1001', document_date: '2026-03-12' },
          fhmo_signer: { full_name: 'Специалист ФХМ' },
          totals: { total_amount_rub: '1500.00' },
          items: [{ service_name: 'Матч', total_amount_rub: '1500.00' }],
        },
      }),
      DocumentType: {
        alias: 'REFEREE_CLOSING_ACT',
        generated: true,
        name: 'Акт',
      },
      DocumentStatus: { alias: 'SIGNED' },
      recipient: { id: 'ref-2', last_name: 'Судья', first_name: 'Петр' },
      update: jest.fn().mockResolvedValue({}),
    })
    .mockResolvedValueOnce({
      id: 'doc-closing-code-1',
      update: rollbackDocUpdate,
    });
  docUserSignCount.mockResolvedValue(1);
  docUserSignFindOne.mockResolvedValue(null);
  docUserSignFindAll.mockResolvedValue([
    {
      id: 'sig-fhmo',
      user_id: 'fhmo-1',
      created_at: new Date('2026-03-12T12:00:00.000Z'),
      User: {
        id: 'fhmo-1',
        last_name: 'Дробот',
        first_name: 'Алексей',
        patronymic: 'Андреевич',
        Roles: [
          { alias: 'FHMO_JUDGING_LEAD_SPECIALIST', name: 'Ведущий специалист' },
        ],
      },
      SignType: { alias: 'SIMPLE_ELECTRONIC', name: 'ПЭП' },
    },
    {
      id: 'sig-ref',
      user_id: 'ref-2',
      created_at: new Date('2026-03-13T10:00:00.000Z'),
      User: {
        id: 'ref-2',
        last_name: 'Судья',
        first_name: 'Петр',
        patronymic: 'Петрович',
        Roles: [],
      },
      SignType: { alias: 'SIMPLE_ELECTRONIC', name: 'ПЭП' },
    },
  ]);
  userSignFindOne.mockResolvedValue({ sign_type_id: 'sign-1' });
  docStatusFindOne.mockImplementation(({ where }) => {
    if (where.alias === 'SIGNED') return Promise.resolve({ id: 10 });
    if (where.alias === 'AWAITING_SIGNATURE')
      return Promise.resolve({ id: 20 });
    return Promise.resolve(null);
  });
  docTypeFindByPk.mockResolvedValue({ alias: 'REFEREE_CLOSING_ACT' });
  saveGeneratedPdf.mockRejectedValueOnce(
    Object.assign(new Error('upload failed'), { code: 's3_upload_failed' })
  );

  await expect(
    documentService.signWithCode(
      { id: 'ref-2', token_version: 1 },
      'doc-closing-code-1',
      '123456'
    )
  ).rejects.toMatchObject({ code: 's3_upload_failed' });

  expect(docUserSignDestroy).toHaveBeenCalledWith({
    where: { document_id: 'doc-closing-code-1', user_id: 'ref-2' },
  });
  expect(rollbackDocUpdate).toHaveBeenCalledWith({
    status_id: 20,
    updated_by: 'ref-2',
  });
  expect(handleRecipientSignedMock).not.toHaveBeenCalled();
  expect(sendSignedMock).not.toHaveBeenCalled();
});
