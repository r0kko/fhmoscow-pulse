import { beforeEach, describe, expect, jest, test } from '@jest/globals';

let matchFindByPkMock;
let resolveMatchAccessContextMock;
let evaluateStaffMatchRestrictionsMock;
let buildPermissionPayloadMock;
let service;

beforeEach(async () => {
  jest.resetModules();
  matchFindByPkMock = jest.fn();
  resolveMatchAccessContextMock = jest.fn();
  evaluateStaffMatchRestrictionsMock = jest.fn();
  buildPermissionPayloadMock = jest.fn().mockReturnValue({});

  jest.unstable_mockModule('../src/models/index.js', () => ({
    __esModule: true,
    Match: { findByPk: matchFindByPkMock },
    Team: {},
    TeamPlayer: { findAll: jest.fn() },
    ClubPlayer: {},
    Player: {},
    PlayerRole: { findAll: jest.fn() },
    MatchPlayer: { findAll: jest.fn() },
    Tournament: {},
    TournamentType: {},
    Stage: {},
    TournamentGroup: {},
    Tour: {},
  }));

  jest.unstable_mockModule('../src/config/database.js', () => ({
    __esModule: true,
    default: { literal: (value) => value },
  }));

  jest.unstable_mockModule('../src/utils/matchAccess.js', () => ({
    __esModule: true,
    resolveMatchAccessContext: resolveMatchAccessContextMock,
    evaluateStaffMatchRestrictions: evaluateStaffMatchRestrictionsMock,
    buildPermissionPayload: buildPermissionPayloadMock,
  }));

  ({ default: service } =
    await import('../src/services/matchLineupService.js'));
});

describe('matchLineupService.list access guards', () => {
  test('throws 404 when match not found', async () => {
    matchFindByPkMock.mockResolvedValue(null);

    await expect(service.list('missing', 'actor')).rejects.toMatchObject({
      code: 404,
      message: 'match_not_found',
    });
  });

  test('throws 409 when both match teams are unset', async () => {
    matchFindByPkMock.mockResolvedValue({
      id: 'm1',
      team1_id: null,
      team2_id: null,
    });

    await expect(service.list('m1', 'actor')).rejects.toMatchObject({
      code: 409,
      message: 'match_teams_not_set',
    });
  });

  test('throws 403 when actor is outside match scope', async () => {
    matchFindByPkMock.mockResolvedValue({
      id: 'm2',
      team1_id: 't1',
      team2_id: 't2',
    });
    resolveMatchAccessContextMock.mockResolvedValue({
      isHome: false,
      isAway: false,
      isAdmin: false,
    });
    evaluateStaffMatchRestrictionsMock.mockReturnValue({
      lineupsBlocked: false,
    });

    await expect(service.list('m2', 'user-1')).rejects.toMatchObject({
      code: 403,
      message: 'forbidden_not_match_member',
    });
  });

  test('throws 403 when staff position blocks lineup operations', async () => {
    matchFindByPkMock.mockResolvedValue({
      id: 'm3',
      team1_id: 't1',
      team2_id: 't2',
      season_id: 's1',
    });
    resolveMatchAccessContextMock.mockResolvedValue({
      isHome: true,
      isAway: false,
      isAdmin: false,
    });
    evaluateStaffMatchRestrictionsMock.mockReturnValue({
      lineupsBlocked: true,
    });

    await expect(service.list('m3', 'user-2')).rejects.toMatchObject({
      code: 403,
      message: 'staff_position_restricted',
    });
    expect(buildPermissionPayloadMock).not.toHaveBeenCalled();
  });
});
