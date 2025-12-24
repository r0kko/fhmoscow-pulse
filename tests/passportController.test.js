import { expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: { getByUser: jest.fn(), fetchFromLegacy: jest.fn() },
}));

jest.unstable_mockModule('../src/mappers/passportMapper.js', () => ({
  __esModule: true,
  default: { toPublic: jest.fn((p) => p) },
}));

const { default: controller } =
  await import('../src/controllers/passportController.js');
const service = await import('../src/services/passportService.js');

test('me returns stored passport', async () => {
  service.default.getByUser.mockResolvedValue({ id: 'p1' });
  service.default.fetchFromLegacy.mockResolvedValue(null);
  const req = { user: { id: 'u1' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.me(req, res);
  expect(res.json).toHaveBeenCalled();
  expect(service.default.fetchFromLegacy).not.toHaveBeenCalled();
});

test('me returns legacy passport when none stored', async () => {
  service.default.getByUser.mockResolvedValue(null);
  service.default.fetchFromLegacy.mockResolvedValue({
    series: '11',
    number: '000022',
    issue_date: '2000-01-01',
    issuing_authority: 'OVD',
    issuing_authority_code: '770-000',
    document_type: 'CIVIL',
    country: 'RU',
  });
  const req = { user: { id: 'u1', birth_date: '1990-01-01' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.me(req, res);
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

test('me returns 404 when no passport data found', async () => {
  service.default.getByUser.mockResolvedValue(null);
  service.default.fetchFromLegacy.mockResolvedValue(null);
  const req = { user: { id: 'u2' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.me(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: 'passport_not_found' });
});
