import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const tx = { id: 'tx' };
const transactionMock = jest.fn(async (fn) => fn(tx));
const matchFindAllMock = jest.fn();
const extGamePlayerFindAllMock = jest.fn();
const extGameStaffFindAllMock = jest.fn();
const extRoleFindAllMock = jest.fn();
const extPositionFindAllMock = jest.fn();
const teamFindAllMock = jest.fn();
const playerFindAllMock = jest.fn();
const staffFindAllMock = jest.fn();
const playerRoleFindAllMock = jest.fn();
const participantPlayerFindAllMock = jest.fn();
const participantPlayerCreateMock = jest.fn();
const participantPlayerUpdateMock = jest.fn();
const participantStaffFindAllMock = jest.fn();
const participantStaffCreateMock = jest.fn();
const participantStaffUpdateMock = jest.fn();

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: transactionMock },
}));

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  GamePlayer: { findAll: extGamePlayerFindAllMock },
  GameStaff: { findAll: extGameStaffFindAllMock },
  TeamPlayerRole: { findAll: extRoleFindAllMock },
  PlayerPosition: { findAll: extPositionFindAllMock },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findAll: matchFindAllMock },
  Team: { findAll: teamFindAllMock },
  Player: { findAll: playerFindAllMock },
  Staff: { findAll: staffFindAllMock },
  PlayerRole: { findAll: playerRoleFindAllMock },
  MatchParticipantPlayer: {
    findAll: participantPlayerFindAllMock,
    create: participantPlayerCreateMock,
    update: participantPlayerUpdateMock,
  },
  MatchParticipantStaff: {
    findAll: participantStaffFindAllMock,
    create: participantStaffCreateMock,
    update: participantStaffUpdateMock,
  },
}));

jest.unstable_mockModule('../logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const { syncExternal } =
  await import('../src/services/matchParticipantSyncService.js');

function matchRow() {
  return {
    id: 'match-1',
    external_id: 501,
    team1_id: 'team-home',
    team2_id: 'team-away',
    HomeTeam: { id: 'team-home', external_id: 10 },
    AwayTeam: { id: 'team-away', external_id: 20 },
  };
}

beforeEach(() => {
  transactionMock.mockClear();
  matchFindAllMock.mockReset();
  extGamePlayerFindAllMock.mockReset();
  extGameStaffFindAllMock.mockReset();
  extRoleFindAllMock.mockReset();
  extPositionFindAllMock.mockReset();
  teamFindAllMock.mockReset();
  playerFindAllMock.mockReset();
  staffFindAllMock.mockReset();
  playerRoleFindAllMock.mockReset();
  participantPlayerFindAllMock.mockReset();
  participantPlayerCreateMock.mockReset();
  participantPlayerUpdateMock.mockReset().mockResolvedValue([0]);
  participantStaffFindAllMock.mockReset();
  participantStaffCreateMock.mockReset();
  participantStaffUpdateMock.mockReset().mockResolvedValue([0]);
});

test('creates player and staff snapshots while preserving external ids when local people are missing', async () => {
  matchFindAllMock
    .mockResolvedValueOnce([matchRow()])
    .mockResolvedValueOnce([]);
  extGamePlayerFindAllMock.mockResolvedValueOnce([
    {
      id: 1001,
      game_id: 501,
      player_id: 777,
      team_id: 10,
      number: 31,
      role_id: 1,
      position_id: 3,
      lineup_number: 2,
      played: null,
      played_in_lineup: 1,
    },
  ]);
  extGameStaffFindAllMock.mockResolvedValueOnce([
    {
      id: 2001,
      game_id: 501,
      staff_id: 888,
      team_id: 10,
      position: 'Главный тренер',
    },
  ]);
  teamFindAllMock.mockResolvedValue([{ id: 'team-home', external_id: 10 }]);
  playerFindAllMock.mockResolvedValue([]);
  staffFindAllMock.mockResolvedValue([]);
  playerRoleFindAllMock.mockResolvedValue([
    { id: 'role-gk', external_id: 1, name: 'Вратарь' },
  ]);
  extRoleFindAllMock.mockResolvedValue([
    { id: 1, name: 'Вратарь', abbreviation: 'ВР' },
  ]);
  extPositionFindAllMock.mockResolvedValue([
    { id: 3, name: 'Игрок', abbreviation: 'И' },
  ]);
  participantPlayerFindAllMock.mockResolvedValue([]);
  participantStaffFindAllMock.mockResolvedValue([]);

  const stats = await syncExternal({ actorId: 'admin', batchSize: 10 });

  expect(stats).toMatchObject({
    matches: 1,
    players: { upserts: 1 },
    staff: { upserts: 1 },
  });
  expect(participantPlayerCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      external_id: 1001,
      match_id: 'match-1',
      team_id: 'team-home',
      player_id: null,
      external_game_id: 501,
      external_team_id: 10,
      external_player_id: 777,
      role_id: 'role-gk',
      role_external_id: 1,
      role_name: 'Вратарь',
      role_abbreviation: 'ВР',
      match_position_external_id: 3,
      match_position_name: 'Игрок',
      number: 31,
      lineup_number: 2,
      played: null,
      played_in_lineup: 1,
      team_side: 1,
      created_by: 'admin',
      updated_by: 'admin',
    }),
    expect.objectContaining({ transaction: tx })
  );
  expect(participantStaffCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      external_id: 2001,
      match_id: 'match-1',
      team_id: 'team-home',
      staff_id: null,
      external_staff_id: 888,
      position: 'Главный тренер',
      team_side: 1,
    }),
    expect.objectContaining({ transaction: tx })
  );
});

test('updates existing snapshots and soft-deletes stale participants by match scope', async () => {
  const existingPlayer = {
    id: 'local-player-row',
    external_id: 1001,
    match_id: 'match-1',
    team_id: 'team-home',
    player_id: 'player-old',
    role_id: 'role-old',
    external_game_id: 501,
    external_team_id: 10,
    external_player_id: 777,
    role_external_id: 1,
    role_name: 'Вратарь',
    number: 1,
    lineup_number: null,
    played: false,
    played_in_lineup: null,
    team_side: 1,
    deletedAt: null,
    update: jest.fn().mockResolvedValue(undefined),
    restore: jest.fn().mockResolvedValue(undefined),
  };
  const stalePlayer = { external_id: 9999, deletedAt: null };
  const existingStaff = {
    id: 'local-staff-row',
    external_id: 2001,
    match_id: 'match-1',
    team_id: 'team-home',
    staff_id: 'staff-old',
    external_game_id: 501,
    external_team_id: 10,
    external_staff_id: 888,
    position: 'Тренер',
    team_side: 1,
    deletedAt: null,
    update: jest.fn().mockResolvedValue(undefined),
    restore: jest.fn().mockResolvedValue(undefined),
  };

  matchFindAllMock
    .mockResolvedValueOnce([matchRow()])
    .mockResolvedValueOnce([]);
  extGamePlayerFindAllMock.mockResolvedValueOnce([
    {
      id: 1001,
      game_id: 501,
      player_id: 777,
      team_id: 10,
      number: 35,
      role_id: 1,
      position_id: 1,
      lineup_number: 1,
      played: 1,
      played_in_lineup: 1,
    },
  ]);
  extGameStaffFindAllMock.mockResolvedValueOnce([
    {
      id: 2001,
      game_id: 501,
      staff_id: 888,
      team_id: 10,
      position: 'Главный тренер',
    },
  ]);
  teamFindAllMock.mockResolvedValue([{ id: 'team-home', external_id: 10 }]);
  playerFindAllMock.mockResolvedValue([{ id: 'player-new', external_id: 777 }]);
  staffFindAllMock.mockResolvedValue([{ id: 'staff-new', external_id: 888 }]);
  playerRoleFindAllMock.mockResolvedValue([
    { id: 'role-new', external_id: 1, name: 'Вратарь' },
  ]);
  extRoleFindAllMock.mockResolvedValue([
    { id: 1, name: 'Вратарь', abbreviation: 'ВР' },
  ]);
  extPositionFindAllMock.mockResolvedValue([
    { id: 1, name: 'Капитан', abbreviation: 'К' },
  ]);
  participantPlayerFindAllMock.mockResolvedValue([existingPlayer, stalePlayer]);
  participantStaffFindAllMock.mockResolvedValue([existingStaff]);

  await syncExternal({ actorId: 'admin', batchSize: 10 });

  expect(existingPlayer.update).toHaveBeenCalledWith(
    expect.objectContaining({
      player_id: 'player-new',
      role_id: 'role-new',
      number: 35,
      lineup_number: 1,
      played: true,
      played_in_lineup: 1,
      updated_by: 'admin',
    }),
    expect.objectContaining({ transaction: tx })
  );
  expect(existingStaff.update).toHaveBeenCalledWith(
    expect.objectContaining({
      staff_id: 'staff-new',
      position: 'Главный тренер',
      updated_by: 'admin',
    }),
    expect.objectContaining({ transaction: tx })
  );
  expect(participantPlayerUpdateMock).toHaveBeenCalledWith(
    expect.objectContaining({ deletedAt: expect.any(Date) }),
    expect.objectContaining({
      where: expect.objectContaining({
        match_id: { [Op.in]: ['match-1'] },
        external_id: { [Op.notIn]: [1001] },
      }),
      paranoid: false,
      transaction: tx,
    })
  );
});
