import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const findAndCountAllMock = jest.fn();

const findAllMock = jest.fn();
const clubModel = {
  findAndCountAll: findAndCountAllMock,
  findAll: findAllMock,
};
const teamModel = { __name: 'Team' };
const groundModel = { __name: 'Ground' };

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Club: clubModel,
  Team: teamModel,
  Ground: groundModel,
}));

const { default: service } = await import('../src/services/clubService.js');

beforeEach(() => {
  findAndCountAllMock.mockReset().mockResolvedValue({ rows: [], count: 0 });
  findAllMock.mockReset().mockResolvedValue([]);
});

test('list builds search and includes teams/grounds', async () => {
  await service.list({
    page: 1,
    limit: 10,
    search: 'Spartak',
    includeTeams: true,
    includeGrounds: true,
  });
  expect(findAndCountAllMock).toHaveBeenCalled();
  const args = findAndCountAllMock.mock.calls[0][0];
  // Search by name iLike
  expect(args.where.name[Op.iLike]).toBe('%Spartak%');
  // Includes both Team and Ground
  const includeModels = args.include.map((i) => i.model);
  expect(includeModels).toContain(teamModel);
  expect(includeModels).toContain(groundModel);
  // Pagination
  expect(args.limit).toBe(10);
  expect(args.offset).toBe(0);
});

test('list uses defaults and computes offset', async () => {
  await service.list({ page: 3, limit: 5 });
  const args = findAndCountAllMock.mock.calls[0][0];
  expect(args.limit).toBe(5);
  expect(args.offset).toBe(10);
});

test('listAll returns sorted clubs', async () => {
  await service.listAll();
  const args = findAllMock.mock.calls[0][0];
  expect(args.order).toEqual([['name', 'ASC']]);
});
