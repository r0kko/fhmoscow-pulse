import { beforeEach, expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const findAllMock = jest.fn();
const createMock = jest.fn();
const sendEmailMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  MedicalCertificate: { findOne: findOneMock, findAll: findAllMock, create: createMock },
  User: { findByPk: jest.fn().mockResolvedValue({ id: 'u1', email: 'e' }) },
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: { sendMedicalCertificateAddedEmail: sendEmailMock },
}));

const { default: service } = await import('../src/services/medicalCertificateService.js');

beforeEach(() => {
  sendEmailMock.mockClear();
  createMock.mockClear();
  findOneMock.mockClear();
  findAllMock.mockClear();
});

test('getByUser selects latest valid certificate', async () => {
  const cert = { id: 'c2' };
  findOneMock.mockResolvedValue(cert);
  const res = await service.getByUser('u1');
  expect(res).toBe(cert);
  const opts = findOneMock.mock.calls[0][0];
  expect(opts.order).toEqual([["valid_until", "DESC"]]);
  expect(opts.where.user_id).toBe('u1');
  const key = Object.getOwnPropertySymbols(opts.where.valid_until)[0];
  expect(key.toString()).toContain('gte');
  expect(typeof opts.where.valid_until[key]).toBe('string');
  const key2 = Object.getOwnPropertySymbols(opts.where.issue_date)[0];
  expect(key2.toString()).toContain('lte');
  expect(typeof opts.where.issue_date[key2]).toBe('string');
});

test('createForUser creates certificate for existing user', async () => {
  const data = {
    inn: '1',
    organization: 'Org',
    certificate_number: 'num',
    issue_date: '2024-01-01',
    valid_until: '2025-01-01',
  };
  createMock.mockResolvedValue(data);
  const res = await service.createForUser('u1', data, 'a1');
  expect(createMock).toHaveBeenCalledWith({
    user_id: 'u1',
    ...data,
    created_by: 'a1',
    updated_by: 'a1',
  });
  expect(res).toBe(data);
  expect(sendEmailMock).toHaveBeenCalledWith({ id: 'u1', email: 'e' });
});

test('createForUser skips email when actor is user', async () => {
  createMock.mockResolvedValue({});
  await service.createForUser('u1', {}, 'u1');
  expect(sendEmailMock).not.toHaveBeenCalled();
});

test('listByUser selects only expired certificates', async () => {
  findAllMock.mockResolvedValue([]);
  await service.listByUser('u1');
  const opts = findAllMock.mock.calls[0][0];
  expect(opts.order).toEqual([["issue_date", "DESC"]]);
  expect(opts.where.user_id).toBe('u1');
  const key = Object.getOwnPropertySymbols(opts.where.valid_until)[0];
  expect(key.toString()).toContain('lt');
  expect(typeof opts.where.valid_until[key]).toBe('string');
});
