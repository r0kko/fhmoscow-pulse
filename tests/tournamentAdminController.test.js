import { beforeEach, expect, jest, test } from '@jest/globals';

const listTypesMock = jest.fn();
const listTournamentsMock = jest.fn();
const listStagesMock = jest.fn();
const listGroupsMock = jest.fn();
const listTTMock = jest.fn();
const sendErrorMock = jest.fn();

beforeEach(() => {
  listTypesMock.mockReset();
  listTournamentsMock.mockReset();
  listStagesMock.mockReset();
  listGroupsMock.mockReset();
  listTTMock.mockReset();
  sendErrorMock.mockReset();
});

jest.unstable_mockModule('../src/services/tournamentAdminService.js', () => ({
  __esModule: true,
  default: {
    listTypes: listTypesMock,
    listTournaments: listTournamentsMock,
    listStages: listStagesMock,
    listGroups: listGroupsMock,
    listTournamentTeams: listTTMock,
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

jest.unstable_mockModule('../src/utils/api.js', () => ({
  __esModule: true,
  sendError: sendErrorMock,
}));

const { default: controller } =
  await import('../src/controllers/tournamentAdminController.js');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

test('listTypes maps response', async () => {
  listTypesMock.mockResolvedValue([{ id: 't1' }]);
  const res = mockRes();
  await controller.listTypes({}, res);
  expect(toPublicType.mock.calls[0][0]).toEqual({ id: 't1' });
  expect(res.json).toHaveBeenCalledWith({ types: [{ id: 't1' }] });
});

test('listTournaments maps and passes query', async () => {
  listTournamentsMock.mockResolvedValue({ rows: [{ id: 't1' }], count: 1 });
  const req = {
    query: {
      page: '2',
      limit: '5',
      q: 'cup',
      season_id: 's',
      type_id: 'tt',
      birth_year: '2010',
      status: 'ALL',
    },
  };
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
  expect(res.json).toHaveBeenCalledWith({
    tournaments: [{ id: 't1' }],
    total: 1,
  });
});

test('listGroups uses q alias', async () => {
  listGroupsMock.mockResolvedValue({ rows: [], count: 0 });
  const req = { query: { q: 'Group A', page: '1', limit: '10' } };
  const res = mockRes();
  await controller.listGroups(req, res);
  expect(listGroupsMock).toHaveBeenCalledWith({
    page: 1,
    limit: 10,
    search: 'Group A',
    tournament_id: undefined,
    stage_id: undefined,
    status: undefined,
  });
});

test('listStages forwards filters and maps rows', async () => {
  listStagesMock.mockResolvedValue({ rows: [{ id: 's1' }], count: 3 });
  const res = mockRes();
  await controller.listStages(
    { query: { page: '3', limit: '7', status: 'ACTIVE' } },
    res
  );
  expect(listStagesMock).toHaveBeenCalledWith({
    page: 3,
    limit: 7,
    tournament_id: undefined,
    status: 'ACTIVE',
  });
  expect(toPublicStage.mock.calls[0][0]).toEqual({ id: 's1' });
  expect(res.json).toHaveBeenCalledWith({ stages: [{ id: 's1' }], total: 3 });
});

test('listTournamentTeams maps payload', async () => {
  listTTMock.mockResolvedValue({ rows: [{ id: 'team1' }], count: 2 });
  const res = mockRes();
  await controller.listTournamentTeams(
    { query: { page: '4', limit: '8', q: 'Spartak', tournament_id: 't1' } },
    res
  );
  expect(listTTMock).toHaveBeenCalledWith({
    page: 4,
    limit: 8,
    search: 'Spartak',
    tournament_id: 't1',
    group_id: undefined,
    team_id: undefined,
    status: undefined,
  });
  expect(res.json).toHaveBeenCalledWith({
    teams: [{ id: 'team1' }],
    total: 2,
  });
});

test('listTournaments delegates errors to sendError', async () => {
  const err = new Error('boom');
  listTournamentsMock.mockRejectedValueOnce(err);
  const res = mockRes();
  await controller.listTournaments({ query: {} }, res);
  expect(sendErrorMock).toHaveBeenCalledWith(res, err);
});
