import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import ServiceError from '../src/errors/ServiceError.js';

const sendMock = jest.fn();
const getBucketMock = jest.fn();

jest.unstable_mockModule('../src/utils/externalS3Client.js', () => ({
  __esModule: true,
  default: { send: sendMock },
}));

jest.unstable_mockModule('../src/config/externalS3.js', () => ({
  __esModule: true,
  getExternalS3Bucket: getBucketMock,
}));

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  __esModule: true,
  PutObjectCommand: function PutObjectCommand(input) {
    this.input = input;
    return this;
  },
  DeleteObjectCommand: function DeleteObjectCommand(input) {
    this.input = input;
    return this;
  },
}));

const { default: service } =
  await import('../src/services/externalFileStorageService.js');

beforeEach(() => {
  sendMock.mockReset();
  getBucketMock.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('uploadBuffer fails fast when bucket is not configured', async () => {
  getBucketMock.mockReturnValue(undefined);
  await expect(
    service.uploadBuffer({ key: 'avatar.png', body: Buffer.from('data') })
  ).rejects.toMatchObject({
    code: 'external_s3_not_configured',
    status: 500,
  });
  expect(sendMock).not.toHaveBeenCalled();
});

test('uploadBuffer validates input payload and key', async () => {
  getBucketMock.mockReturnValue('ext-bucket');
  await expect(
    service.uploadBuffer({ key: 'file', body: 'not-a-buffer' })
  ).rejects.toBeInstanceOf(ServiceError);
  await expect(
    service.uploadBuffer({ key: '', body: Buffer.from('payload') })
  ).rejects.toMatchObject({ code: 'external_s3_invalid_key' });
});

test('uploadBuffer normalizes keys and sets defaults', async () => {
  getBucketMock.mockReturnValue('bucket');
  sendMock.mockResolvedValueOnce({});
  await service.uploadBuffer({
    key: '/nested/path/file.jpg/',
    body: Buffer.from('data'),
  });
  expect(sendMock).toHaveBeenCalledTimes(1);
  const command = sendMock.mock.calls[0][0];
  expect(command.input).toEqual({
    Bucket: 'bucket',
    Key: 'nested/path/file.jpg',
    Body: Buffer.from('data'),
    ContentType: 'application/octet-stream',
  });
});

test('uploadBuffer wraps upstream failures with ServiceError', async () => {
  getBucketMock.mockReturnValue('bucket');
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  sendMock.mockRejectedValueOnce(new Error('S3 down'));
  await expect(
    service.uploadBuffer({ key: 'file', body: Buffer.from('x') })
  ).rejects.toMatchObject({
    code: 'external_s3_upload_failed',
    status: 502,
    cause: expect.any(Error),
  });
  errSpy.mockRestore();
});

test('removeObject skips missing keys and swallows errors', async () => {
  getBucketMock.mockReturnValue('bucket');
  await service.removeObject({ key: '' });
  expect(sendMock).not.toHaveBeenCalled();

  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  sendMock.mockRejectedValueOnce(new Error('delete failed'));
  await expect(
    service.removeObject({ key: 'folder/file.png' })
  ).resolves.toBeUndefined();
  expect(sendMock).toHaveBeenCalledTimes(1);
  const deleteCommand = sendMock.mock.calls[0][0];
  expect(deleteCommand.input).toEqual({
    Bucket: 'bucket',
    Key: 'folder/file.png',
  });
  errSpy.mockRestore();
});
