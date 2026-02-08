import { beforeEach, expect, jest, test } from '@jest/globals';

const assignTeamToGroupMock = jest.fn();
const listTournamentMatchesMock = jest.fn();
const createMatchScheduleMock = jest.fn();
const sendErrorMock = jest.fn();

beforeEach(() => {
  assignTeamToGroupMock.mockReset();
  listTournamentMatchesMock.mockReset();
  createMatchScheduleMock.mockReset();
  sendErrorMock.mockReset();
});

jest.unstable_mockModule('../src/services/tournamentAdminService.js', () => ({
  __esModule: true,
  default: {
    assignTeamToGroup: assignTeamToGroupMock,
    listTournamentMatches: listTournamentMatchesMock,
    createMatchSchedule: createMatchScheduleMock,
  },
}));

const toPublicTournamentTeam = jest.fn((x) => x);
const toPublicTournamentMatch = jest.fn((x) => x);

jest.unstable_mockModule('../src/mappers/tournamentMapper.js', () => ({
  __esModule: true,
  default: {
    toPublicTournamentTeam,
    toPublicTournamentMatch,
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
  });
  const res = mockRes();

  await controller.listTournamentMatches(
    {
      query: {
        page: '2',
        limit: '25',
        tournament_id: 't1',
        stage_id: 's1',
        status: 'ALL',
      },
    },
    res
  );

  expect(listTournamentMatchesMock).toHaveBeenCalledWith({
    page: 2,
    limit: 25,
    tournament_id: 't1',
    stage_id: 's1',
    status: 'ALL',
  });
  expect(res.json).toHaveBeenCalledWith({ matches: [{ id: 'm1' }], total: 1 });
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
