/* global process */
import { expect, jest, test, beforeEach } from '@jest/globals';
import { Buffer } from 'buffer';
import { MAX_NORMATIVE_FILE_SIZE } from '../src/config/fileLimits.js';

const sendMock = jest.fn();
const findByPkMock = jest.fn();
const findOneMock = jest.fn();
const mcFindAllMock = jest.fn();
const fileCreateMock = jest.fn();
const mcCreateMock = jest.fn();
const mcFindMock = jest.fn();
const ticketFindByPkMock = jest.fn();
const ticketFileCreateMock = jest.fn();
const ticketFileFindByPkMock = jest.fn();
const ticketFileFindAllMock = jest.fn();
const ticketFileFindOneMock = jest.fn();

jest.unstable_mockModule('../src/utils/s3Client.js', () => ({
  __esModule: true,
  default: { send: sendMock },
}));

const getSignedUrlMock = jest.fn(async () => 'signed');

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  __esModule: true,
  PutObjectCommand: function PutObjectCommand(args) {
    this.args = args;
  },
  GetObjectCommand: function GetObjectCommand(args) {
    this.args = args;
  },
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
    findAll: mcFindAllMock,
  },
  MedicalCertificateType: { findOne: findOneMock },
  Ticket: { findByPk: ticketFindByPkMock },
  TicketFile: {
    create: ticketFileCreateMock,
    findByPk: ticketFileFindByPkMock,
    findAll: ticketFileFindAllMock,
    findOne: ticketFileFindOneMock,
  },
}));

beforeEach(() => {
  sendMock.mockClear();
  findByPkMock.mockClear();
  findOneMock.mockClear();
  mcFindAllMock.mockClear();
  fileCreateMock.mockClear();
  mcCreateMock.mockClear();
  mcFindMock.mockClear();
  ticketFindByPkMock.mockClear();
  ticketFileCreateMock.mockClear();
  ticketFileFindByPkMock.mockClear();
  ticketFileFindAllMock.mockClear();
  ticketFileFindOneMock.mockClear();
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

test('uploadForCertificate validates file type', async () => {
  process.env.S3_BUCKET = 'test';
  const { default: service } = await import('../src/services/fileService.js');
  findByPkMock.mockResolvedValue({ id: '1', getUser: () => ({ last_name: 'L', first_name: 'F' }) });
  findOneMock.mockResolvedValue({ id: 't', name: 'Type' });
  const file = { originalname: 'test.exe', mimetype: 'application/x-msdownload', size: 10 };
  await expect(
    service.uploadForCertificate('1', file, 'CONCLUSION', 'u1'),
  ).rejects.toThrow('invalid_file_type');
});

test('uploadForCertificate validates file size', async () => {
  process.env.S3_BUCKET = 'test';
  const { default: service } = await import('../src/services/fileService.js');
  findByPkMock.mockResolvedValue({ id: '1', getUser: () => ({ last_name: 'L', first_name: 'F' }) });
  findOneMock.mockResolvedValue({ id: 't', name: 'Type' });
  const file = { originalname: 'test.pdf', mimetype: 'application/pdf', size: 6 * 1024 * 1024 };
  await expect(
    service.uploadForCertificate('1', file, 'CONCLUSION', 'u1'),
  ).rejects.toThrow('file_too_large');
});

test('uploadForCertificate uploads and returns attachment', async () => {
  process.env.S3_BUCKET = 'test';
  const { default: service } = await import('../src/services/fileService.js');
  findByPkMock.mockResolvedValue({ id: '1', getUser: () => ({ last_name: 'L', first_name: 'F' }) });
  findOneMock.mockResolvedValue({ id: 't', name: 'Type' });
  fileCreateMock.mockResolvedValue({ id: 'f1' });
  mcCreateMock.mockResolvedValue({ id: 'm1' });
  mcFindMock.mockResolvedValue({ id: 'm1' });
  const file = { originalname: 'a.pdf', mimetype: 'application/pdf', size: 10, buffer: Buffer.from('1') };
  const res = await service.uploadForCertificate('1', file, 'CONCLUSION', 'u1');
  expect(sendMock).toHaveBeenCalled();
  expect(fileCreateMock).toHaveBeenCalled();
  expect(mcCreateMock).toHaveBeenCalled();
  expect(mcFindMock).toHaveBeenCalled();
  expect(res).toEqual({ id: 'm1' });
});

test('getDownloadUrl returns signed url', async () => {
  process.env.S3_BUCKET = 'bucket';
  const { default: service } = await import('../src/services/fileService.js');
  const url = await service.getDownloadUrl({ key: 'k' });
  expect(getSignedUrlMock).toHaveBeenCalled();
  expect(url).toBe('signed');
});

test('uploadForTicket uploads file', async () => {
  process.env.S3_BUCKET = 'test';
  const { default: service } = await import('../src/services/fileService.js');
  ticketFindByPkMock.mockResolvedValue({ id: 't1', getUser: () => ({ last_name: 'L', first_name: 'F' }) });
  fileCreateMock.mockResolvedValue({ id: 'f1' });
  ticketFileCreateMock.mockResolvedValue({ id: 'tf1' });
  ticketFileFindByPkMock.mockResolvedValue({ id: 'tf1' });
  const file = { originalname: 'doc.pdf', mimetype: 'application/pdf', size: 100, buffer: Buffer.from('1') };
  const res = await service.uploadForTicket('t1', file, 'u1');
  expect(sendMock).toHaveBeenCalled();
  expect(ticketFileCreateMock).toHaveBeenCalled();
  expect(res).toEqual({ id: 'tf1' });
});

test('uploadForNormativeTicket validates file size', async () => {
  process.env.S3_BUCKET = 'test';
  const { default: service } = await import('../src/services/fileService.js');
  ticketFindByPkMock.mockResolvedValue({ id: 't1' });
  const bigFile = {
    originalname: 'v.mp4',
    mimetype: 'video/mp4',
    size: MAX_NORMATIVE_FILE_SIZE + 1024 * 1024,
  };
  await expect(
    service.uploadForNormativeTicket(
      't1',
      bigFile,
      'u1',
      { last_name: 'L', first_name: 'F' },
      { name: 'Type' }
    ),
  ).rejects.toThrow('file_too_large');
});

test('uploadForNormativeTicket uploads file', async () => {
  process.env.S3_BUCKET = 'test';
  const { default: service } = await import('../src/services/fileService.js');
  ticketFindByPkMock.mockResolvedValue({ id: 't1' });
  fileCreateMock.mockResolvedValue({ id: 'f1' });
  ticketFileCreateMock.mockResolvedValue({ id: 'tf1' });
  ticketFileFindByPkMock.mockResolvedValue({ id: 'tf1' });
  const file = {
    originalname: 'v.mp4',
    mimetype: 'video/mp4',
    size: 100,
    buffer: Buffer.from('1'),
  };
  const res = await service.uploadForNormativeTicket(
    't1',
    file,
    'u1',
    { last_name: 'L', first_name: 'F' },
    { name: 'Type' }
  );
  expect(sendMock).toHaveBeenCalled();
  expect(ticketFileCreateMock).toHaveBeenCalled();
  expect(res).toEqual({ id: 'tf1' });
});

test('removeTicketFile deletes attachment', async () => {
  const updateA = jest.fn();
  const updateB = jest.fn();
  const destroyA = jest.fn();
  const destroyB = jest.fn();
  ticketFileFindOneMock.mockResolvedValue({
    update: updateA,
    destroy: destroyA,
    File: { update: updateB, destroy: destroyB },
  });
  const { default: service } = await import('../src/services/fileService.js');
  await service.removeTicketFile('f1', 'u1');
  expect(updateA).toHaveBeenCalled();
  expect(updateB).toHaveBeenCalled();
  expect(destroyA).toHaveBeenCalled();
  expect(destroyB).toHaveBeenCalled();
});

