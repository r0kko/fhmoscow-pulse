import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const documentFindByPk = jest.fn();
const signTypeFindByPk = jest.fn();
const removeFileMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Document: { findByPk: documentFindByPk },
  DocumentStatus: {},
  DocumentType: {},
  SignType: { findByPk: signTypeFindByPk },
  DocumentUserSign: {},
  UserSignType: {},
  File: {},
  User: {},
}));

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: {
    removeFile: removeFileMock,
    saveGeneratedPdf: jest.fn(),
    saveUploaded: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendDocumentSignCode: jest.fn(),
    notifyDocumentSigned: jest.fn(),
  },
}));

const { default: documentService } =
  await import('../src/services/documentService.js');

beforeEach(() => {
  documentFindByPk.mockReset();
  signTypeFindByPk.mockReset();
  removeFileMock.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('update rejects when document is missing', async () => {
  documentFindByPk.mockResolvedValueOnce(null);
  await expect(
    documentService.update('doc-1', {}, 'actor')
  ).rejects.toMatchObject({ code: 'document_not_found', status: 404 });
});

test('update rejects unknown sign type', async () => {
  documentFindByPk.mockResolvedValueOnce({ id: 'doc-1' });
  signTypeFindByPk.mockResolvedValueOnce(null);
  await expect(
    documentService.update('doc-1', { signTypeId: 'sign-x' }, 'actor-1')
  ).rejects.toMatchObject({ code: 'sign_type_not_found', status: 404 });
});

test('update applies sign type and stamps actor', async () => {
  const updateMock = jest.fn().mockResolvedValue({});
  documentFindByPk.mockResolvedValueOnce({ id: 'doc-2', update: updateMock });
  signTypeFindByPk.mockResolvedValueOnce({ id: 'sign-1' });
  await documentService.update('doc-2', { signTypeId: 'sign-1' }, 'actor-9');
  expect(updateMock).toHaveBeenCalledWith({
    sign_type_id: 'sign-1',
    updated_by: 'actor-9',
  });
});

test('remove rejects missing document', async () => {
  documentFindByPk.mockResolvedValueOnce(null);
  await expect(documentService.remove('doc-3', 'actor')).rejects.toMatchObject({
    code: 'document_not_found',
    status: 404,
  });
});

test('remove forbids deleting signed simple electronic documents', async () => {
  documentFindByPk.mockResolvedValueOnce({
    id: 'doc-4',
    SignType: { alias: 'SIMPLE_ELECTRONIC' },
    DocumentStatus: { alias: 'SIGNED' },
  });
  await expect(documentService.remove('doc-4', 'actor')).rejects.toMatchObject({
    code: 'document_delete_forbidden_signed_simple',
    status: 403,
  });
});

test('remove deletes document and file when allowed', async () => {
  const updateMock = jest.fn().mockResolvedValue({});
  const destroyMock = jest.fn().mockResolvedValue({});
  documentFindByPk.mockResolvedValueOnce({
    id: 'doc-5',
    file_id: 99,
    update: updateMock,
    destroy: destroyMock,
  });
  await documentService.remove('doc-5', 'actor-3');
  expect(updateMock).toHaveBeenCalledWith({ updated_by: 'actor-3' });
  expect(destroyMock).toHaveBeenCalled();
  expect(removeFileMock).toHaveBeenCalledWith(99);
});
