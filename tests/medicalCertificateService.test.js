import { beforeEach, expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const findAllMock = jest.fn();
const createMock = jest.fn();
const updateMock = jest.fn();
const destroyMock = jest.fn();
const findByPkMock = jest.fn();
const findAndCountAllMock = jest.fn();
const findAllUsersMock = jest.fn();
const sendEmailMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  MedicalCertificate: {
    findOne: findOneMock,
    findAll: findAllMock,
    create: createMock,
    findByPk: findByPkMock,
    findAndCountAll: findAndCountAllMock,
  },
  User: {
    findByPk: jest.fn().mockResolvedValue({ id: 'u1', email: 'e' }),
    findAll: findAllUsersMock,
  },
  Role: {},
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: { sendMedicalCertificateAddedEmail: sendEmailMock },
}));

const { default: service } =
  await import('../src/services/medicalCertificateService.js');

beforeEach(() => {
  sendEmailMock.mockClear();
  createMock.mockClear();
  findOneMock.mockClear();
  findAllMock.mockClear();
  updateMock.mockClear();
  destroyMock.mockClear();
  findByPkMock.mockClear();
  findAndCountAllMock.mockClear();
  findAllUsersMock.mockClear();
});

test('getByUser selects latest valid certificate', async () => {
  const cert = { id: 'c2' };
  findOneMock.mockResolvedValue(cert);
  const res = await service.getByUser('u1');
  expect(res).toBe(cert);
  const opts = findOneMock.mock.calls[0][0];
  expect(opts.order).toEqual([['valid_until', 'DESC']]);
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
  expect(opts.order).toEqual([['issue_date', 'DESC']]);
  expect(opts.where.user_id).toBe('u1');
  const key = Object.getOwnPropertySymbols(opts.where.valid_until)[0];
  expect(key.toString()).toContain('lt');
  expect(typeof opts.where.valid_until[key]).toBe('string');
});

test('getById returns certificate', async () => {
  findByPkMock.mockResolvedValue({ id: 'c1' });
  const res = await service.getById('c1');
  expect(res).toEqual({ id: 'c1' });
});

test('getById throws when missing', async () => {
  findByPkMock.mockResolvedValue(null);
  await expect(service.getById('c2')).rejects.toThrow('certificate_not_found');
});

test('updateForUser updates certificate', async () => {
  findOneMock.mockResolvedValue({ update: updateMock });
  const data = { inn: '1' };
  await service.updateForUser('u1', data, 'admin');
  expect(updateMock).toHaveBeenCalled();
});

test('removeForUser deletes certificate', async () => {
  findOneMock.mockResolvedValue({ update: updateMock, destroy: destroyMock });
  await service.removeForUser('u1', 'adm');
  expect(updateMock).toHaveBeenCalledWith({ updated_by: 'adm' });
  expect(destroyMock).toHaveBeenCalled();
});

test('listAll forwards pagination', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  const res = await service.listAll({ page: 2, limit: 5 });
  const arg = findAndCountAllMock.mock.calls[0][0];
  expect(arg.limit).toBe(5);
  expect(arg.offset).toBe(5);
  expect(res).toEqual({ rows: [], count: 0 });
});

test('listByRole groups certificates', async () => {
  findAllUsersMock.mockResolvedValue([{ id: 'u1' }]);
  findAllMock.mockResolvedValue([{ id: 'c1', user_id: 'u1' }]);
  const res = await service.listByRole('REF');
  expect(findAllUsersMock).toHaveBeenCalled();
  expect(res).toEqual([
    { user: { id: 'u1' }, certificates: [{ id: 'c1', user_id: 'u1' }] },
  ]);
});
