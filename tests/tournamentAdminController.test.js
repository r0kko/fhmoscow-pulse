import { beforeEach, expect, jest, test } from '@jest/globals';

const listTournamentsMock = jest.fn();
const listStagesMock = jest.fn();
const listGroupsMock = jest.fn();
const listTTMock = jest.fn();

beforeEach(() => {
  listTournamentsMock.mockReset();
  listStagesMock.mockReset();
  listGroupsMock.mockReset();
  listTTMock.mockReset();
});

jest.unstable_mockModule('../src/services/tournamentAdminService.js', () => ({
  __esModule: true,
  default: {
    listTournaments: listTournamentsMock,
    listStages: listStagesMock,
    listGroups: listGroupsMock,
    listTournamentTeams: listTTMock,
    listTypes: jest.fn().mockResolvedValue([]),
  },
}));

const toPublicTournament = jest.fn((x) => x);
const toPublicStage = jest.fn((x) => x);
const toPublicGroup = jest.fn((x) => x);
const toPublicTournamentTeam = jest.fn((x) => x);
const toPublicType = jest.fn((x) => x);

jest.unstable_mockModule('../src/mappers/tournamentMapper.js', () => ({
  __esModule: true,
  default: {
    toPublicTournament,
    toPublicStage,
    toPublicGroup,
    toPublicTournamentTeam,
    toPublicType,
  },
}));

const { default: controller } = await import('../src/controllers/tournamentAdminController.js');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

test('listTournaments maps and passes query', async () => {
  listTournamentsMock.mockResolvedValue({ rows: [{ id: 't1' }], count: 1 });
  const req = { query: { page: '2', limit: '5', q: 'cup', season_id: 's', type_id: 'tt', birth_year: '2010', status: 'ALL' } };
  const res = mockRes();
  await controller.listTournaments(req, res);
  expect(listTournamentsMock).toHaveBeenCalledWith({
    page: 2,
    limit: 5,
    search: 'cup',
    season_id: 's',
    type_id: 'tt',
    birth_year: '2010',
    status: 'ALL',
  });
  expect(res.json).toHaveBeenCalledWith({ tournaments: [{ id: 't1' }], total: 1 });
});

test('listGroups uses q alias', async () => {
  listGroupsMock.mockResolvedValue({ rows: [], count: 0 });
  const req = { query: { q: 'Group A', page: '1', limit: '10' } };
  const res = mockRes();
  await controller.listGroups(req, res);
  expect(listGroupsMock).toHaveBeenCalledWith({ page: 1, limit: 10, search: 'Group A', tournament_id: undefined, stage_id: undefined, status: undefined });
});

