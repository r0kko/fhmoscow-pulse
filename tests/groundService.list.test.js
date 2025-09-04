import { beforeEach, expect, jest, test } from '@jest/globals';

const findAndCountAllMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Address: {},
  Club: {},
  Team: {},
  Ground: { findAndCountAll: findAndCountAllMock },
}));

jest.unstable_mockModule('../src/services/dadataService.js', () => ({
  __esModule: true,
  cleanAddress: jest.fn(),
}));

const { default: service } = await import('../src/services/groundService.js');

beforeEach(() => {
  findAndCountAllMock.mockReset().mockResolvedValue({ rows: [], count: 0 });
});

test('listAll applies search and toggles includes and filters', async () => {
  await service.listAll({
    page: 1,
    limit: 10,
    search: 'Arena',
    withClubs: true,
    withTeams: true,
    hasAddress: true,
    imported: true,
    withYandex: true,
  });
  const args = findAndCountAllMock.mock.calls[0][0];
  expect(args.where).toBeDefined();
  expect(args.include.length).toBeGreaterThanOrEqual(3); // Address + Clubs + Teams
  expect(args.limit).toBe(10);
  expect(args.offset).toBe(0);
});
