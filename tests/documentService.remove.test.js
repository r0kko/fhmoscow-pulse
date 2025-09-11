import { expect, jest, test } from '@jest/globals';

// Mock models to control Document lookup
const updateMock = jest.fn();
const destroyMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Document: {
    findByPk: jest.fn().mockResolvedValue({
      id: 'doc-1',
      SignType: { alias: 'SIMPLE_ELECTRONIC' },
      DocumentStatus: { alias: 'SIGNED' },
      update: updateMock,
      destroy: destroyMock,
      file_id: 'file-1',
    }),
  },
  // Minimal placeholders for other named exports not used in this test
  DocumentStatus: {},
  SignType: {},
  DocumentType: {},
  File: {},
  DocumentUserSign: {},
  UserSignType: {},
  User: {},
}));

// Ensure fileService is not called in forbidden path
jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: {
    removeFile: jest.fn(),
  },
}));

const documentService = (await import('../src/services/documentService.js'))
  .default;

test('remove forbids deleting SES-signed documents', async () => {
  await expect(
    documentService.remove('doc-1', 'admin-1')
  ).rejects.toMatchObject({
    code: 'document_delete_forbidden_signed_simple',
    status: 403,
  });
  // Ensure no destructive actions were performed
  expect(updateMock).not.toHaveBeenCalled();
  expect(destroyMock).not.toHaveBeenCalled();
});
