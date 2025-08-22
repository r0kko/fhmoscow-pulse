import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const findAndCountAllMock = jest.fn(async () => ({ rows: [], count: 0 }));

beforeEach(() => {
  findAndCountAllMock.mockClear();
});

// Mock models for teamService.list
jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Team: { findAndCountAll: findAndCountAllMock },
  Club: {},
  User: {},
  UserTeam: {},
}));

// Ensure external models are not loaded (avoid heavy coverage impact)
jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Team: {},
}));

const { default: service } = await import('../src/services/teamService.js');

test('list defaults to ACTIVE (paranoid) without deleted_at filter', async () => {
  await service.list({ page: 1, limit: 5 });
  const args = findAndCountAllMock.mock.calls[0][0];
  expect(args.paranoid).toBe(true);
  expect(args.where).toBeDefined();
  expect(args.where.deleted_at).toBeUndefined();
});

test('list supports ARCHIVED status with deleted_at != null', async () => {
  await service.list({ status: 'ARCHIVED' });
  const args = findAndCountAllMock.mock.calls[0][0];
  expect(args.paranoid).toBe(false);
  expect(args.where.deleted_at).toEqual({ [Op.ne]: null });
});

test('list supports ALL status without deleted_at filter', async () => {
  await service.list({ status: 'ALL' });
  const args = findAndCountAllMock.mock.calls[0][0];
  expect(args.paranoid).toBe(false);
  expect(args.where.deleted_at).toBeUndefined();
});

test("list maps club_id 'none' to NULL", async () => {
  await service.list({ club_id: 'none' });
  const args = findAndCountAllMock.mock.calls[0][0];
  expect(args.where.club_id).toBeNull();
});

test('list applies search and birth_year filters', async () => {
  await service.list({ search: 'abc', birth_year: '2005' });
  const args = findAndCountAllMock.mock.calls[0][0];
  expect(args.where.name).toEqual({ [Op.iLike]: '%abc%' });
  expect(args.where.birth_year).toBe(2005);
});
