import { beforeEach, expect, jest, test, describe } from '@jest/globals';

const docFindByPkMock = jest.fn();
const signTypeFindByPkMock = jest.fn();
const docUpdateMock = jest.fn();
const docDestroyMock = jest.fn();
const fileRemoveMock = jest.fn();
const docTypeFindOneMock = jest.fn();
const docFindOneMock = jest.fn();
const userFindByPkMock = jest.fn();

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: { removeFile: fileRemoveMock, saveGeneratedPdf: jest.fn() },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Document: {
    findByPk: docFindByPkMock,
    findOne: docFindOneMock,
  },
  SignType: { findByPk: signTypeFindByPkMock },
  DocumentType: { findOne: docTypeFindOneMock },
  DocumentStatus: {},
  DocumentUserSign: {},
  File: {},
  UserSignType: {},
  User: { findByPk: userFindByPkMock },
}));

const service = (await import('../src/services/documentService.js')).default;

beforeEach(() => {
  docFindByPkMock.mockReset();
  signTypeFindByPkMock.mockReset();
  docUpdateMock.mockReset();
  docDestroyMock.mockReset();
  fileRemoveMock.mockReset();
  docTypeFindOneMock.mockReset();
  docFindOneMock.mockReset();
  userFindByPkMock.mockReset();
});

describe('documentService.update/remove', () => {
  test('update throws when document not found', async () => {
    docFindByPkMock.mockResolvedValue(null);
    await expect(service.update('d1', {}, 'actor')).rejects.toMatchObject({
      code: 'document_not_found',
    });
  });

  test('update validates sign type', async () => {
    docFindByPkMock.mockResolvedValue({ id: 'd1', update: docUpdateMock });
    signTypeFindByPkMock.mockResolvedValue(null);
    await expect(
      service.update('d1', { signTypeId: 'x' }, 'actor')
    ).rejects.toMatchObject({ code: 'sign_type_not_found' });
  });

  test('update returns unchanged document when no updates provided', async () => {
    const doc = { id: 'd1', update: docUpdateMock };
    docFindByPkMock.mockResolvedValue(doc);
    const res = await service.update('d1', {}, 'actor');
    expect(res).toBe(doc);
    expect(docUpdateMock).not.toHaveBeenCalled();
  });

  test('remove deletes file when present', async () => {
    const doc = {
      id: 'd2',
      file_id: 'f1',
      update: docUpdateMock,
      destroy: docDestroyMock,
    };
    docFindByPkMock.mockResolvedValue(doc);
    await service.remove('d2', 'actor');
    expect(docUpdateMock).toHaveBeenCalledWith({ updated_by: 'actor' });
    expect(docDestroyMock).toHaveBeenCalled();
    expect(fileRemoveMock).toHaveBeenCalledWith('f1');
  });

  test('remove throws when document missing', async () => {
    docFindByPkMock.mockResolvedValue(null);
    await expect(service.remove('dx', 'actor')).rejects.toMatchObject({
      code: 'document_not_found',
    });
  });
});

describe('documentService.generatePersonalDataConsent', () => {
  test('throws user_not_found when neither document nor user exists', async () => {
    docFindByPkMock.mockResolvedValue(null);
    docTypeFindOneMock.mockResolvedValue(null);
    userFindByPkMock.mockResolvedValue(null);
    await expect(
      service.generatePersonalDataConsent('u1')
    ).rejects.toMatchObject({ code: 'user_not_found' });
  });
});
