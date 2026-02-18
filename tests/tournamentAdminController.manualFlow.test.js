import { beforeEach, expect, jest, test } from '@jest/globals';

const assignTeamToGroupMock = jest.fn();
const listTournamentMatchesMock = jest.fn();
const createMatchScheduleMock = jest.fn();
const getTournamentByIdMock = jest.fn();
const updateTournamentMatchMock = jest.fn();
const deleteTournamentMatchMock = jest.fn();
const sendErrorMock = jest.fn();

beforeEach(() => {
  assignTeamToGroupMock.mockReset();
  listTournamentMatchesMock.mockReset();
  createMatchScheduleMock.mockReset();
  getTournamentByIdMock.mockReset();
  updateTournamentMatchMock.mockReset();
  deleteTournamentMatchMock.mockReset();
  sendErrorMock.mockReset();
});

jest.unstable_mockModule('../src/services/tournamentAdminService.js', () => ({
  __esModule: true,
  default: {
    assignTeamToGroup: assignTeamToGroupMock,
    listTournamentMatches: listTournamentMatchesMock,
    createMatchSchedule: createMatchScheduleMock,
    getTournamentById: getTournamentByIdMock,
    updateTournamentMatch: updateTournamentMatchMock,
    deleteTournamentMatch: deleteTournamentMatchMock,
  },
}));

const toPublicTournamentTeam = jest.fn((x) => x);
const toPublicTournamentMatch = jest.fn((x) => x);
const toPublicTournament = jest.fn((x) => x);

jest.unstable_mockModule('../src/mappers/tournamentMapper.js', () => ({
  __esModule: true,
  default: {
    toPublicTournamentTeam,
    toPublicTournamentMatch,
    toPublicTournament,
  },
}));

jest.unstable_mockModule('../src/utils/api.js', () => ({
  __esModule: true,
  sendError: sendErrorMock,
}));

const { default: controller } =
  await import('../src/controllers/tournamentAdminController.js');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

test('createTournamentTeam maps created assignment', async () => {
  assignTeamToGroupMock.mockResolvedValue({ id: 'tt1' });
  const res = mockRes();

  await controller.createTournamentTeam(
    { body: { team_id: 'team-1' }, user: { id: 'admin-1' } },
    res
  );

  expect(assignTeamToGroupMock).toHaveBeenCalledWith(
    { team_id: 'team-1' },
    'admin-1'
  );
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ team: { id: 'tt1' } });
});

test('listTournamentMatches maps rows and forwards filters', async () => {
  listTournamentMatchesMock.mockResolvedValue({
    rows: [{ id: 'm1' }],
    count: 1,
    summary: { total: 1, upcoming: 1, past: 0, cancelled: 0 },
    days: [{ day: '2026-01-10', count: 1 }],
  });
  const res = mockRes();

  await controller.listTournamentMatches(
    {
      query: {
        page: '2',
        limit: '25',
        tournament_id: 't1',
        stage_id: 's1',
        q: 'Суперкубок',
        sort: 'DESC',
        status: 'ALL',
      },
    },
    res
  );

  expect(listTournamentMatchesMock).toHaveBeenCalledWith({
    page: 2,
    limit: 25,
    search: 'Суперкубок',
    tournament_id: 't1',
    stage_id: 's1',
    without_stage: undefined,
    date_from: undefined,
    date_to: undefined,
    status: 'ALL',
    sort: 'DESC',
  });
  expect(res.json).toHaveBeenCalledWith({
    matches: [{ id: 'm1' }],
    total: 1,
    page: 2,
    limit: 25,
    summary: { total: 1, upcoming: 1, past: 0, cancelled: 0 },
    days: [{ day: '2026-01-10', count: 1 }],
  });
});

test('createTournamentMatch maps created match', async () => {
  createMatchScheduleMock.mockResolvedValue({ id: 'm9' });
  const res = mockRes();

  await controller.createTournamentMatch(
    { body: { stage_id: 's1' }, user: { id: 'admin-2' } },
    res
  );

  expect(createMatchScheduleMock).toHaveBeenCalledWith(
    { stage_id: 's1' },
    'admin-2'
  );
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ match: { id: 'm9' } });
});

test('getTournament returns mapped entity', async () => {
  getTournamentByIdMock.mockResolvedValue({ id: 't100' });
  const res = mockRes();
  await controller.getTournament({ params: { id: 't100' } }, res);
  expect(getTournamentByIdMock).toHaveBeenCalledWith('t100');
  expect(res.json).toHaveBeenCalledWith({ tournament: { id: 't100' } });
});

test('updateTournamentMatch maps updated match', async () => {
  updateTournamentMatchMock.mockResolvedValue({ id: 'm5' });
  const res = mockRes();
  await controller.updateTournamentMatch(
    { params: { id: 'm5' }, body: { ground_id: 'g1' }, user: { id: 'a1' } },
    res
  );
  expect(updateTournamentMatchMock).toHaveBeenCalledWith(
    'm5',
    { ground_id: 'g1' },
    'a1'
  );
  expect(res.json).toHaveBeenCalledWith({ match: { id: 'm5' } });
});

test('deleteTournamentMatch returns ok=true', async () => {
  deleteTournamentMatchMock.mockResolvedValue(true);
  const res = mockRes();
  await controller.deleteTournamentMatch(
    { params: { id: 'm8' }, user: { id: 'a2' } },
    res
  );
  expect(deleteTournamentMatchMock).toHaveBeenCalledWith('m8', 'a2');
  expect(res.json).toHaveBeenCalledWith({ ok: true });
});
