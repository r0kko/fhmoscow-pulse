import { expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const createMock = jest.fn();
const destroyMock = jest.fn();
const findByPkMock = jest.fn();
const findTypeMock = jest.fn();
const findCountryMock = jest.fn();
const findExtMock = jest.fn();
const legacyFindMock = jest.fn();
const cleanPassportMock = jest.fn();

const passportInstance = { destroy: destroyMock };

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Passport: {
    findOne: findOneMock,
    create: createMock,
  },
  DocumentType: { findOne: findTypeMock },
  Country: { findOne: findCountryMock },
  User: { findByPk: findByPkMock },
  UserExternalId: { findOne: findExtMock },
}));

jest.unstable_mockModule('../src/services/legacyUserService.js', () => ({
  __esModule: true,
  default: { findById: legacyFindMock },
}));

jest.unstable_mockModule('../src/services/dadataService.js', () => ({
  __esModule: true,
  default: { cleanPassport: cleanPassportMock },
}));

const { default: service } = await import('../src/services/passportService.js');

test('getByUser calls model with associations', async () => {
  const pass = { id: 'p1' };
  findOneMock.mockResolvedValue(pass);
  const res = await service.getByUser('u1');
  expect(res).toBe(pass);
  expect(findOneMock).toHaveBeenCalledWith({
    where: { user_id: 'u1' },
    include: [expect.any(Object), expect.any(Object)],
  });
});

test('createForUser validates and creates passport', async () => {
  findByPkMock.mockResolvedValue({ id: 'u1' });
  findOneMock.mockResolvedValueOnce(null); // check existing
  findTypeMock.mockResolvedValue({ id: 't1' });
  findCountryMock.mockResolvedValue({ id: 'c1' });
  createMock.mockResolvedValue(passportInstance);
  findOneMock.mockResolvedValueOnce(passportInstance); // for getByUser after create

  cleanPassportMock.mockResolvedValue({
    qc: 0,
    series: '45 12',
    number: '123456',
    issue_date: '2020-01-01',
    issue_org: 'OVD',
    issue_code: '770-000',
  });
  const data = {
    document_type: 'CIVIL',
    country: 'RU',
    series: '4512',
    number: '123456',
    issue_date: '2020-01-01',
    issuing_authority: 'OVD',
    issuing_authority_code: '770-000',
  };
  const res = await service.createForUser('u1', data, 'admin');
  expect(cleanPassportMock).toHaveBeenCalledWith('4512 123456');
  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'u1', document_type_id: 't1', country_id: 'c1' })
  );
  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({
      issue_date: '2020-01-01',
      issuing_authority: 'OVD',
      issuing_authority_code: '770-000',
    })
  );
  expect(res).toBe(passportInstance);
});

test('createForUser calculates valid_until for RU CIVIL passport', async () => {
  findByPkMock.mockResolvedValue({ id: 'u1', birth_date: '1990-01-01' });
  findOneMock.mockResolvedValueOnce(null);
  findTypeMock.mockResolvedValue({ id: 't1' });
  findCountryMock.mockResolvedValue({ id: 'c1' });
  createMock.mockResolvedValue(passportInstance);
  findOneMock.mockResolvedValueOnce(passportInstance);
  cleanPassportMock.mockResolvedValue({
    qc: 0,
    series: '4512',
    number: '123456',
    issue_date: '2010-02-03',
    issue_org: 'OVD',
    issue_code: '770-000',
  });

  const data = {
    document_type: 'CIVIL',
    country: 'RU',
    series: '4512',
    number: '123456',
    issue_date: '2010-02-03',
    issuing_authority: 'OVD',
    issuing_authority_code: '770-000',
  };
  await service.createForUser('u1', data, 'admin');
  expect(cleanPassportMock).toHaveBeenCalledWith('4512 123456');
  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({ valid_until: '2035-01-01' })
  );
});

test('removeByUser destroys passport', async () => {
  findOneMock.mockResolvedValue(passportInstance);
  await service.removeByUser('u1');
  expect(destroyMock).toHaveBeenCalled();
});

test('importFromLegacy returns existing passport', async () => {
  findOneMock.mockResolvedValue(passportInstance);
  const res = await service.importFromLegacy('u1');
  expect(res).toBe(passportInstance);
  expect(findExtMock).not.toHaveBeenCalled();
});

test('importFromLegacy creates passport from legacy data', async () => {
  findOneMock.mockResolvedValueOnce(null); // initial check
  findExtMock.mockResolvedValue({ external_id: '5' });
  legacyFindMock.mockResolvedValue({
    ps_ser: '11',
    ps_num: '22',
    ps_date: '2000-01-01',
    ps_org: 'OVD',
    ps_pdrz: '770-000',
  });
  findByPkMock.mockResolvedValue({ id: 'u1', birth_date: '1990-01-01' });
  findOneMock.mockResolvedValueOnce(null); // createForUser existing check
  findTypeMock.mockResolvedValue({ id: 't1' });
  findCountryMock.mockResolvedValue({ id: 'c1' });
  createMock.mockResolvedValue(passportInstance);
  findOneMock.mockResolvedValueOnce(passportInstance); // getByUser after create
  cleanPassportMock.mockResolvedValue({
    qc: 0,
    series: '11',
    number: '000022',
    issue_date: '2000-01-01',
    issue_org: 'OVD',
    issue_code: '770-000',
  });

  const res = await service.importFromLegacy('u1');
  expect(createMock).toHaveBeenCalled();
  expect(res).toBe(passportInstance);
});

test('createForUser ignores DaData failure', async () => {
  findByPkMock.mockResolvedValue({ id: 'u2' });
  findOneMock.mockResolvedValueOnce(null);
  findTypeMock.mockResolvedValue({ id: 't1' });
  findCountryMock.mockResolvedValue({ id: 'c1' });
  cleanPassportMock.mockResolvedValue(null);
  createMock.mockResolvedValue(passportInstance);
  findOneMock.mockResolvedValueOnce(passportInstance);

  const data = { document_type: 'CIVIL', country: 'RU', series: '45', number: '12' };
  const res = await service.createForUser('u2', data, 'admin');
  expect(cleanPassportMock).toHaveBeenCalled();
  expect(res).toBe(passportInstance);
});

