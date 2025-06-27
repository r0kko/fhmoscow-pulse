import { expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: { getByUser: jest.fn(), importFromLegacy: jest.fn() },
}));

jest.unstable_mockModule('../src/mappers/passportMapper.js', () => ({
  __esModule: true,
  default: { toPublic: jest.fn((p) => p) },
}));

const findOneExtMock = jest.fn();
const legacyFindMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  UserExternalId: { findOne: findOneExtMock },
}));

jest.unstable_mockModule('../src/services/legacyUserService.js', () => ({
  __esModule: true,
  default: { findById: legacyFindMock },
}));

const { default: controller } = await import('../src/controllers/passportController.js');
const service = await import('../src/services/passportService.js');

test('me returns stored passport', async () => {
  service.default.getByUser.mockResolvedValue({ id: 'p1' });
  service.default.importFromLegacy.mockResolvedValue(null);
  const req = { user: { id: 'u1' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.me(req, res);
  expect(res.json).toHaveBeenCalled();
  expect(service.default.importFromLegacy).not.toHaveBeenCalled();
});

test('me returns legacy passport when none stored', async () => {
  service.default.getByUser.mockResolvedValue(null);
  service.default.importFromLegacy.mockResolvedValue(null);
  findOneExtMock.mockResolvedValue({ external_id: '5' });
  legacyFindMock.mockResolvedValue({ ps_ser: '11', ps_num: '22', ps_date: '2000-01-01', ps_org: 'OVD', ps_pdrz: '770-000' });
  const req = { user: { id: 'u1', birth_date: '1990-01-01' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.me(req, res);
  expect(service.default.importFromLegacy).toHaveBeenCalledWith('u1');
  expect(res.json).toHaveBeenCalledWith({
    passport: {
      series: '11',
      number: '000022',
      issue_date: '2000-01-01',
      valid_until: '2010-04-01',
      issuing_authority: 'OVD',
      issuing_authority_code: '770-000',
      document_type: 'CIVIL',
      country: 'RU',
    },
  });
});

test('me returns persisted passport from legacy', async () => {
  service.default.getByUser.mockResolvedValue(null);
  service.default.importFromLegacy.mockResolvedValue({ id: 'p2' });
  findOneExtMock.mockClear();
  const req = { user: { id: 'u2' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.me(req, res);
  expect(service.default.importFromLegacy).toHaveBeenCalledWith('u2');
  expect(res.json).toHaveBeenCalledWith({ passport: { id: 'p2' } });
  expect(findOneExtMock).not.toHaveBeenCalled();
});
