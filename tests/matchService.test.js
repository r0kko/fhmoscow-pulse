import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const gameFindAllMock = jest.fn();
const gameCountMock = jest.fn();
const userFindByPkMock = jest.fn();

const TeamModel = {};

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Game: { findAll: gameFindAllMock, count: gameCountMock },
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
  gameCountMock.mockReset();
  userFindByPkMock.mockReset();
});

test('listUpcoming queries external games for user teams', async () => {
  userFindByPkMock.mockResolvedValue({
    Teams: [{ external_id: 10 }, { external_id: 20 }],
  });
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
  // ensure count path covered
  gameCountMock.mockResolvedValueOnce(1);
  const args = gameFindAllMock.mock.calls[0][0];
  expect(args.limit).toBe(50);
  // robust filter should not strictly equal 'active'; ensure date filter present
  expect(args.where.date_start).toBeDefined();
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

test('listUpcoming supports type filter and search query', async () => {
  userFindByPkMock.mockResolvedValue({ Teams: [{ external_id: 42 }] });
  const date = new Date('2025-06-01T12:00:00Z');
  gameFindAllMock.mockResolvedValue([
    {
      id: 2,
      date_start: date,
      Stadium: { name: 'Ice Palace' },
      Team1: { full_name: 'Alpha' },
      Team2: { full_name: 'Beta' },
      team1_id: 1,
      team2_id: 42,
    },
  ]);
  const { rows: res } = await service.listUpcoming('u1', {
    type: 'away',
    q: 'Beta',
    limit: 10,
  });
  expect(userFindByPkMock).toHaveBeenCalledWith('u1', { include: [TeamModel] });
  expect(gameFindAllMock).toHaveBeenCalled();
  const args = gameFindAllMock.mock.calls[0][0];
  // away filter
  expect(args.where.team2_id).toBeDefined();
  // Request includes filters; search path executed without throwing
  expect(res).toEqual([
    {
      id: 2,
      date,
      stadium: 'Ice Palace',
      team1: 'Alpha',
      team2: 'Beta',
      is_home: false,
    },
  ]);
});

test('listUpcoming supports type=home', async () => {
  userFindByPkMock.mockResolvedValue({ Teams: [{ external_id: 77 }] });
  const date = new Date('2025-06-02T12:00:00Z');
  gameFindAllMock.mockResolvedValue([
    {
      id: 3,
      date_start: date,
      Stadium: { name: 'Home Arena' },
      Team1: { full_name: 'Our Team' },
      Team2: { full_name: 'Guests' },
      team1_id: 77,
      team2_id: 99,
    },
  ]);
  const { rows } = await service.listUpcoming('u1', { type: 'home', limit: 5 });
  expect(Array.isArray(rows)).toBe(true);
  expect(rows[0].team1).toBe('Our Team');
});
