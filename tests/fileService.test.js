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
}));

beforeEach(() => {
  sendMock.mockClear();
  findByPkMock.mockClear();
  findOneMock.mockClear();
  fileCreateMock.mockClear();
  mcCreateMock.mockClear();
  mcFindMock.mockClear();
  // eslint-disable-next-line no-undef
  delete process.env.S3_BUCKET;
  jest.resetModules();
});

test('uploadForCertificate throws when S3 not configured', async () => {
  const { default: service } = await import('../src/services/fileService.js');
  await expect(
    service.uploadForCertificate('1', {}, 'CONCLUSION', 'u1'),
  ).rejects.toThrow('s3_not_configured');
});

