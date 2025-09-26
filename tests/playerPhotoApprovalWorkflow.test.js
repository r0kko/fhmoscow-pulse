import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const getFileBufferMock = jest.fn();
const uploadBufferMock = jest.fn();
const removeObjectMock = jest.fn();
const insertExternalFileRecordMock = jest.fn();
const updateExternalFileNameMock = jest.fn();
const updateExternalPlayerPhotoIdMock = jest.fn();
const deleteExternalFileByIdMock = jest.fn();
const extFileFindOneMock = jest.fn();
const extFileCreateMock = jest.fn();

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: {
    getFileBuffer: getFileBufferMock,
  },
}));

jest.unstable_mockModule(
  '../src/services/externalFileStorageService.js',
  () => ({
    __esModule: true,
    default: {
      uploadBuffer: uploadBufferMock,
      removeObject: removeObjectMock,
    },
  })
);

jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
  __esModule: true,
  insertExternalFileRecord: insertExternalFileRecordMock,
  updateExternalFileName: updateExternalFileNameMock,
  updateExternalPlayerPhotoId: updateExternalPlayerPhotoIdMock,
  deleteExternalFileById: deleteExternalFileByIdMock,
}));

jest.unstable_mockModule('../src/models/extFile.js', () => ({
  __esModule: true,
  default: {
    findOne: extFileFindOneMock,
    create: extFileCreateMock,
  },
}));

const { processPlayerPhotoApproval } = await import(
  '../src/services/playerPhotoApprovalWorkflow.js'
);

function buildRequest({ fileOverrides = {}, playerOverrides = {} } = {}) {
  const file = {
    id: 'file-local',
    key: 'player-photos/local-key.jpg',
    original_name: 'photo.jpeg',
    mime_type: 'image/jpeg',
    size: 1024,
    ...fileOverrides,
  };
  const player = {
    id: 'player-local',
    external_id: 5755,
    update: jest.fn().mockResolvedValue(),
    Photo: { external_id: 321 },
    ...playerOverrides,
  };
  return { File: file, Player: player };
}

beforeEach(() => {
  jest.clearAllMocks();
  getFileBufferMock.mockResolvedValue(Buffer.from('mock-binary'));
  uploadBufferMock.mockResolvedValue({ key: 'person/player/photo/68353.jpg' });
  insertExternalFileRecordMock.mockResolvedValue({
    id: 68353,
    object_status: 'active',
    date_create: new Date('2024-01-01T00:00:00Z'),
    date_update: new Date('2024-01-01T00:00:00Z'),
  });
  updateExternalFileNameMock.mockResolvedValue({ ok: true, affected: 1 });
  updateExternalPlayerPhotoIdMock.mockResolvedValue({ ok: true, affected: 1 });
  deleteExternalFileByIdMock.mockResolvedValue({ ok: true, affected: 1 });
  extFileFindOneMock.mockResolvedValue(null);
  extFileCreateMock.mockImplementation(async (payload) => ({
    ...payload,
    id: 'ext-local-id',
    update: jest.fn(),
    restore: jest.fn(),
  }));
});

describe('processPlayerPhotoApproval', () => {
  test('uploads using external file id naming convention and updates player photo', async () => {
    const request = buildRequest();

    const result = await processPlayerPhotoApproval({
      request,
      actorId: 'admin-1',
      transaction: {},
    });

    expect(insertExternalFileRecordMock).toHaveBeenCalledWith({
      module: 'playerPhoto',
      mimeType: 'image/jpeg',
      size: 1024,
      name: null,
      objectStatus: 'active',
    });
    expect(uploadBufferMock).toHaveBeenCalledWith({
      key: 'person/player/photo/68353.jpg',
      body: Buffer.from('mock-binary'),
      contentType: 'image/jpeg',
    });
    expect(updateExternalFileNameMock).toHaveBeenCalledWith({
      fileId: 68353,
      name: '68353.jpg',
    });
    expect(updateExternalPlayerPhotoIdMock).toHaveBeenCalledWith({
      playerId: 5755,
      fileId: 68353,
    });
    expect(extFileCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        external_id: 68353,
        name: '68353.jpg',
      }),
      expect.objectContaining({ transaction: {} })
    );
    expect(request.Player.update).toHaveBeenCalledWith(
      { photo_ext_file_id: expect.any(String) },
      { transaction: {} }
    );

    expect(result.relativeName).toBe('68353.jpg');
    expect(result.externalFile.id).toBe(68353);
  });

  test('restores prior state when upload fails', async () => {
    uploadBufferMock.mockRejectedValue(new Error('upload-failed'));
    const request = buildRequest({
      playerOverrides: {
        Photo: { external_id: 999 },
      },
    });

    await expect(
      processPlayerPhotoApproval({
        request,
        actorId: 'moderator-7',
        transaction: {},
      })
    ).rejects.toThrow('upload-failed');

    expect(updateExternalPlayerPhotoIdMock).toHaveBeenCalledWith({
      playerId: 5755,
      fileId: 999,
    });
    expect(deleteExternalFileByIdMock).toHaveBeenCalledWith(68353);
    expect(removeObjectMock).not.toHaveBeenCalled();
  });
});
