import { beforeEach, expect, jest, test } from '@jest/globals';

const listLineupMock = jest.fn();
const listStaffMock = jest.fn();
const findMatchMock = jest.fn();

beforeEach(() => {
  listLineupMock.mockReset();
  listStaffMock.mockReset();
  findMatchMock.mockReset();
});

jest.unstable_mockModule('../src/services/matchLineupService.js', () => ({
  __esModule: true,
  default: { list: listLineupMock },
}));

jest.unstable_mockModule('../src/services/matchStaffService.js', () => ({
  __esModule: true,
  default: { list: listStaffMock },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: findMatchMock },
  Team: {},
  Tournament: {},
  Stage: {},
  TournamentGroup: {},
  Tour: {},
}));

const { default: exportService } = await import('../src/services/matchLineupExportService.js');

test('exportPlayersPdf rejects when any selected player missing match number', async () => {
  findMatchMock.mockResolvedValue({
    id: 'm1',
    date_start: new Date().toISOString(),
    team1_id: 't1',
    team2_id: 't2',
  });
  // 1 GK + 5 field players, captain present; one player has null match_number
  listLineupMock.mockResolvedValue({
    match_id: 'm1',
    team1_id: 't1',
    team2_id: 't2',
    home: {
      players: [
        { selected: true, match_role: { name: 'Вратарь' }, match_number: 1, team_player_id: 'p1' },
        { selected: true, match_role: { name: 'Защитник' }, match_number: 2, team_player_id: 'p2', is_captain: true },
        { selected: true, match_role: { name: 'Нападающий' }, match_number: null, team_player_id: 'p3' },
        { selected: true, match_role: { name: 'Нападающий' }, match_number: 4, team_player_id: 'p4' },
        { selected: true, match_role: { name: 'Нападающий' }, match_number: 5, team_player_id: 'p5' },
        { selected: true, match_role: { name: 'Нападающий' }, match_number: 6, team_player_id: 'p6' },
      ],
    },
    away: { players: [] },
    team1_name: 'Команда 1',
    team2_name: 'Команда 2',
  });
  listStaffMock.mockResolvedValue({
    team1_id: 't1',
    team2_id: 't2',
    home: {
      staff: [
        {
          team_staff_id: 's1',
          full_name: 'Тренер 1',
          selected: true,
          match_role: { name: 'Главный тренер' },
        },
      ],
    },
    away: { staff: [] },
  });
  await expect(exportService.exportPlayersPdf('m1', 't1', 'user')).rejects.toThrow(
    'match_number_required'
  );
});

