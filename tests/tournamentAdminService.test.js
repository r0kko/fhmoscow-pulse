import { beforeEach, expect, jest, test } from '@jest/globals';

const tournamentFindAndCountAllMock = jest.fn();
const stageFindAllMock = jest.fn();
const stageFindAndCountAllMock = jest.fn();
const groupFindAllMock = jest.fn();
const ttFindAllMock = jest.fn();
const ttFindAndCountAllMock = jest.fn();

beforeEach(() => {
  tournamentFindAndCountAllMock.mockReset();
  stageFindAllMock.mockReset();
  stageFindAndCountAllMock.mockReset();
  groupFindAllMock.mockReset();
  ttFindAllMock.mockReset();
  ttFindAndCountAllMock.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Tournament: { findAndCountAll: tournamentFindAndCountAllMock },
  TournamentType: {},
  Stage: {
    findAll: stageFindAllMock,
    findAndCountAll: stageFindAndCountAllMock,
  },
  TournamentGroup: { findAll: groupFindAllMock },
  TournamentTeam: {
    findAll: ttFindAllMock,
    findAndCountAll: ttFindAndCountAllMock,
  },
  Season: {},
  Team: {},
}));

const { default: svc } =
  await import('../src/services/tournamentAdminService.js');

function makeRow(id) {
  return {
    get: ({ plain }) => (plain ? { id, name: `T${id}` } : null),
  };
}

test('listTournaments aggregates counts', async () => {
  tournamentFindAndCountAllMock.mockResolvedValue({
    rows: [makeRow('a'), makeRow('b')],
    count: 2,
  });
  stageFindAllMock.mockResolvedValue([
    { tournament_id: 'a', cnt: '2' },
    { tournament_id: 'b', cnt: '1' },
  ]);
  groupFindAllMock.mockResolvedValue([{ tournament_id: 'a', cnt: '3' }]);
  ttFindAllMock.mockResolvedValue([{ tournament_id: 'b', cnt: '4' }]);

  const { rows, count } = await svc.listTournaments({ page: 1, limit: 10 });
  expect(count).toBe(2);
  expect(rows[0].counts).toEqual({ stages: 2, groups: 3, teams: 0 });
  expect(rows[1].counts).toEqual({ stages: 1, groups: 0, teams: 4 });
});

test('listTournaments applies filters', async () => {
  tournamentFindAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  stageFindAllMock.mockResolvedValue([]);
  groupFindAllMock.mockResolvedValue([]);
  ttFindAllMock.mockResolvedValue([]);
  await svc.listTournaments({
    page: 2,
    limit: 5,
    search: 'Cup',
    season_id: 's1',
    type_id: 't1',
    birth_year: 2010,
    status: 'ARCHIVED',
  });
  const args = tournamentFindAndCountAllMock.mock.calls[0][0];
  expect(args.limit).toBe(5);
  expect(args.offset).toBe(5);
  expect(args.where.season_id).toBe('s1');
  expect(args.where.type_id).toBe('t1');
  expect(args.where.birth_year).toBe(2010);
  // archived mode disables paranoid and adds deleted_at != null condition on later queries
  expect(args.paranoid).toBe(false);
});

test('listStages respects paranoid for ACTIVE and ALL and filters by tournament', async () => {
  stageFindAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  await svc.listStages({
    page: 1,
    limit: 10,
    tournament_id: 'tid',
    status: 'ACTIVE',
  });
  expect(stageFindAndCountAllMock).toHaveBeenCalled();
  let args = stageFindAndCountAllMock.mock.calls[0][0];
  expect(args.where.tournament_id).toBe('tid');
  expect(args.paranoid).toBe(true);

  stageFindAndCountAllMock.mockClear();
  await svc.listStages({
    page: 1,
    limit: 10,
    tournament_id: 'tid',
    status: 'ALL',
  });
  args = stageFindAndCountAllMock.mock.calls[0][0];
  expect(args.paranoid).toBe(false);
});

test('listTournamentTeams adds team where when search present', async () => {
  ttFindAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  await svc.listTournamentTeams({
    page: 1,
    limit: 10,
    search: 'FC',
    tournament_id: 't1',
    group_id: 'g1',
  });
  const args = ttFindAndCountAllMock.mock.calls[0][0];
  expect(args.where.tournament_id).toBe('t1');
  expect(args.where.tournament_group_id).toBe('g1');
  // Ensure include third slot (Team) has where when search provided
  expect(Array.isArray(args.include)).toBe(true);
  expect(args.include[2]).toBeTruthy();
  expect(args.include[2].where).toBeTruthy();
});
