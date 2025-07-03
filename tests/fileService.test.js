/* global process, Buffer */
import { expect, jest, test, beforeEach } from '@jest/globals';

const sendMock = jest.fn();
const findByPkMock = jest.fn();
const findOneMock = jest.fn();
const fileCreateMock = jest.fn();
const mcCreateMock = jest.fn();
const mcFindMock = jest.fn();
const findAllMock = jest.fn();
const findOneAttMock = jest.fn();
const destroyAttachmentMock = jest.fn();
const destroyFileMock = jest.fn();
const getSignedUrlMock = jest.fn();

jest.unstable_mockModule('../src/utils/s3Client.js', () => ({
  __esModule: true,
  default: { send: sendMock },
}));

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
  __esModule: true,
  getSignedUrl: getSignedUrlMock,
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  File: { create: fileCreateMock, findByPk: jest.fn() },
  MedicalCertificate: { findByPk: findByPkMock },
  MedicalCertificateFile: {
    create: mcCreateMock,
    findByPk: mcFindMock,
    findAll: findAllMock,
    findOne: findOneAttMock,
  },
  MedicalCertificateType: { findOne: findOneMock },
}));

beforeEach(() => {
  sendMock.mockClear();
  findByPkMock.mockClear();
  findOneMock.mockClear();
  fileCreateMock.mockClear();
  mcCreateMock.mockClear();
  mcFindMock.mockClear();
  findAllMock.mockClear();
  findOneAttMock.mockClear();
  destroyAttachmentMock.mockClear();
  destroyFileMock.mockClear();
  getSignedUrlMock.mockClear();
  delete process.env.S3_BUCKET;
  jest.resetModules();
});

test('uploadForCertificate throws when S3 not configured', async () => {
  const { default: service } = await import('../src/services/fileService.js');
  await expect(
    service.uploadForCertificate('1', {}, 'CONCLUSION', 'u1'),
  ).rejects.toThrow('s3_not_configured');
});

test('uploadForCertificate uploads and stores file', async () => {
  process.env.S3_BUCKET = 'b';
  findByPkMock.mockResolvedValue({
    getUser: jest.fn().mockResolvedValue({ first_name: 'F', last_name: 'L' }),
  });
  findOneMock.mockResolvedValue({ id: 't1', name: 'Type' });
  fileCreateMock.mockResolvedValue({ id: 'f1' });
  mcCreateMock.mockResolvedValue({ id: 'mc1' });
  mcFindMock.mockResolvedValue('result');
  const { default: service } = await import('../src/services/fileService.js');
  const file = { originalname: 'a.txt', mimetype: 'text/plain', buffer: Buffer.from('x'), size: 1 };
  const res = await service.uploadForCertificate('1', file, 'A', 'actor');
  expect(sendMock).toHaveBeenCalled();
  expect(fileCreateMock).toHaveBeenCalled();
  expect(mcCreateMock).toHaveBeenCalled();
  expect(res).toBe('result');
});

test('listForCertificate returns attachments sorted', async () => {
  const list = [];
  findAllMock.mockResolvedValue(list);
  const { default: service } = await import('../src/services/fileService.js');
  const res = await service.listForCertificate('c1');
  expect(findAllMock).toHaveBeenCalledWith({
    where: { medical_certificate_id: 'c1' },
    include: [expect.anything(), expect.anything()],
    order: [['created_at', 'DESC']],
  });
  expect(res).toBe(list);
});

test('getDownloadUrl returns signed url', async () => {
  process.env.S3_BUCKET = 'b';
  getSignedUrlMock.mockResolvedValue('url');
  const { default: service } = await import('../src/services/fileService.js');
  const res = await service.getDownloadUrl({ key: 'k' });
  expect(getSignedUrlMock).toHaveBeenCalled();
  expect(res).toBe('url');
});

test('remove destroys attachment and file', async () => {
  findOneAttMock.mockResolvedValue({
    destroy: destroyAttachmentMock,
    File: { destroy: destroyFileMock },
  });
  const { default: service } = await import('../src/services/fileService.js');
  await service.remove('f1');
  expect(findOneAttMock).toHaveBeenCalled();
  expect(destroyAttachmentMock).toHaveBeenCalled();
  expect(destroyFileMock).toHaveBeenCalled();
});

test('remove throws when not found', async () => {
  findOneAttMock.mockResolvedValue(null);
  const { default: service } = await import('../src/services/fileService.js');
  await expect(service.remove('f1')).rejects.toThrow('file_not_found');
});

