/* global process */
import { expect, jest, test, beforeEach } from '@jest/globals';

const sendMock = jest.fn();
const findByPkMock = jest.fn();
const findOneMock = jest.fn();
const fileCreateMock = jest.fn();
const mcCreateMock = jest.fn();
const mcFindMock = jest.fn();

jest.unstable_mockModule('../src/utils/s3Client.js', () => ({
  __esModule: true,
  default: { send: sendMock },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  File: { create: fileCreateMock, findByPk: jest.fn() },
  MedicalCertificate: { findByPk: findByPkMock },
  MedicalCertificateFile: { create: mcCreateMock, findByPk: mcFindMock },
  MedicalCertificateType: { findOne: findOneMock },
  Ticket: {},
  TicketFile: {},
}));

beforeEach(() => {
  sendMock.mockClear();
  findByPkMock.mockClear();
  findOneMock.mockClear();
  fileCreateMock.mockClear();
  mcCreateMock.mockClear();
  mcFindMock.mockClear();
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

