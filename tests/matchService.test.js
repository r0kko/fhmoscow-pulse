import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const gameFindAllMock = jest.fn();
const userFindByPkMock = jest.fn();

const TeamModel = {};

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Game: { findAll: gameFindAllMock },
  Team: {},
  Stadium: {},
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findByPk: userFindByPkMock },
  Team: TeamModel,
}));

const { default: service } = await import('../src/services/matchService.js');

beforeEach(() => {
  gameFindAllMock.mockReset();
  userFindByPkMock.mockReset();
});

test('listUpcoming queries external games for user teams', async () => {
  userFindByPkMock.mockResolvedValue({ Teams: [{ external_id: 10 }, { external_id: 20 }] });
  const date = new Date('2025-05-01T10:00:00Z');
  gameFindAllMock.mockResolvedValue([
    {
      id: 1,
      date_start: date,
      Stadium: { name: 'Arena' },
      Team1: { full_name: 'Team A' },
      Team2: { full_name: 'Team B' },
    },
  ]);
  const res = await service.listUpcoming('u1', 50);
  expect(userFindByPkMock).toHaveBeenCalledWith('u1', { include: [TeamModel] });
  expect(gameFindAllMock).toHaveBeenCalled();
  const args = gameFindAllMock.mock.calls[0][0];
  expect(args.limit).toBe(50);
  expect(args.where.object_status).toBe('active');
  expect(args.where[Op.or][0].team1_id[Op.in]).toEqual([10, 20]);
  expect(res).toEqual([
    {
      id: 1,
      date,
      stadium: 'Arena',
      team1: 'Team A',
      team2: 'Team B',
    },
  ]);
});

test('listUpcoming returns empty when user has no teams', async () => {
  userFindByPkMock.mockResolvedValue({ Teams: [] });
  const res = await service.listUpcoming('u1');
  expect(gameFindAllMock).not.toHaveBeenCalled();
  expect(res).toEqual([]);
});
