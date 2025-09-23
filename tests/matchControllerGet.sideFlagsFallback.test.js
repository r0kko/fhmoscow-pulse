import { expect, jest, test, beforeEach } from '@jest/globals';

const findByPkMatchMock = jest.fn();
const findByPkUserMock = jest.fn();
const findAllTeamMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: findByPkMatchMock },
  User: { findByPk: findByPkUserMock },
  Team: { findAll: findAllTeamMock },
  Ground: {},
  Tournament: {},
  TournamentGroup: {},
  Tour: {},
  Season: {},
  Stage: {},
  Address: {},
  Role: {},
  UserClub: {},
  SportSchoolPosition: {},
  MatchBroadcastLink: {},
}));

const { get: getMatch } = await import('../src/controllers/matchController.js');

beforeEach(() => {
  findByPkMatchMock.mockReset();
  findByPkUserMock.mockReset();
  findAllTeamMock.mockReset().mockResolvedValue([]);
});

test('get sets side flags to false when user not found', async () => {
  const req = { params: { id: 'm2' }, user: { id: 'u-missing' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  const next = jest.fn();

  findByPkUserMock.mockResolvedValue(null);
  findByPkMatchMock.mockResolvedValue({
    id: 'm2',
    date_start: '2025-09-10T12:00:00.000Z',
    team1_id: 'h',
    team2_id: 'a',
    Ground: null,
    HomeTeam: { name: 'H' },
    AwayTeam: { name: 'A' },
    Tournament: null,
    Stage: null,
    TournamentGroup: null,
    Tour: null,
    Season: null,
  });

  await getMatch(req, res, next);

  expect(next).not.toHaveBeenCalled();
  const payload = res.json.mock.calls[0][0];
  expect(payload.match.is_home).toBe(false);
  expect(payload.match.is_away).toBe(false);
});
