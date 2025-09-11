import { beforeEach, expect, jest, test } from '@jest/globals';

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

test('listUpcoming (external) falls back to page length when count fails', async () => {
  userFindByPkMock.mockResolvedValue({ Teams: [{ external_id: 7 }] });
  const date = new Date('2025-09-01T10:00:00Z');
  gameFindAllMock.mockResolvedValue([
    {
      id: 1,
      date_start: date,
      Stadium: { name: 'A' },
      Team1: { full_name: 'H' },
      Team2: { full_name: 'G' },
    },
    {
      id: 2,
      date_start: date,
      Stadium: { name: 'B' },
      Team1: { full_name: 'X' },
      Team2: { full_name: 'Y' },
    },
  ]);
  gameCountMock.mockRejectedValue(new Error('boom'));
  const { rows, count } = await service.listUpcoming('u', {
    type: 'all',
    limit: 2,
    offset: 0,
    q: 'H',
  });
  expect(Array.isArray(rows)).toBe(true);
  expect(count).toBe(2);
});

test('listPast (external) builds where and returns rows+count', async () => {
  userFindByPkMock.mockResolvedValue({ Teams: [{ external_id: 11 }] });
  const date = new Date('2024-05-01T10:00:00Z');
  gameFindAllMock.mockResolvedValue([
    {
      id: 10,
      date_start: date,
      Stadium: { name: 'S' },
      Team1: { full_name: 'A' },
      Team2: { full_name: 'B' },
      team1_id: 11,
      team2_id: 99,
    },
  ]);
  gameCountMock.mockResolvedValue(1);
  const { rows, count } = await service.listPast('u', {
    type: 'home',
    q: 'A',
    limit: 1,
    offset: 0,
  });
  expect(count).toBe(1);
  expect(rows[0]).toMatchObject({ id: 10, team1: 'A', team2: 'B' });
  // Ensure ordering is by date descending
  const args = gameFindAllMock.mock.calls[0][0];
  expect(Array.isArray(args.order)).toBe(true);
  expect(args.order[0]).toEqual(['date_start', 'DESC']);
});
