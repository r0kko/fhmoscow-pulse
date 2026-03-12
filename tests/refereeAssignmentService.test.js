import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const matchFindAllMock = jest.fn();
const matchFindByPkMock = jest.fn();
const tournamentGroupRefereeFindAllMock = jest.fn();
const matchRefereeFindAllMock = jest.fn();
const matchRefereeDestroyMock = jest.fn();
const matchRefereeBulkCreateMock = jest.fn();
const matchRefereeUpdateMock = jest.fn();
const matchRefereeDraftClearFindAllMock = jest.fn();
const matchRefereeDraftClearFindOrCreateMock = jest.fn();
const matchRefereeDraftClearUpdateMock = jest.fn();
const matchRefereeDraftClearDestroyMock = jest.fn();
const matchRefereeStatusFindAllMock = jest.fn();
const matchRefereeNotificationFindAllMock = jest.fn();
const matchRefereeNotificationBulkCreateMock = jest.fn();
const matchRefereeNotificationUpdateMock = jest.fn();
const refereeRoleGroupFindByPkMock = jest.fn();
const refereeRoleGroupFindAllMock = jest.fn();
const refereeRoleFindAllMock = jest.fn();
const tournamentTeamFindAllMock = jest.fn();
const userFindAllMock = jest.fn();
const seasonFindOneMock = jest.fn();
const competitionTypeFindAllMock = jest.fn();
const leaguesAccessFindAllMock = jest.fn();
const listForUsersMock = jest.fn();

const transactionMock = jest.fn(async (cb) => cb({}));

beforeEach(() => {
  matchFindAllMock.mockReset();
  matchFindByPkMock.mockReset();
  tournamentGroupRefereeFindAllMock.mockReset();
  matchRefereeFindAllMock.mockReset();
  matchRefereeDestroyMock.mockReset();
  matchRefereeBulkCreateMock.mockReset();
  matchRefereeUpdateMock.mockReset();
  matchRefereeDraftClearFindAllMock.mockReset();
  matchRefereeDraftClearFindOrCreateMock.mockReset();
  matchRefereeDraftClearUpdateMock.mockReset();
  matchRefereeDraftClearDestroyMock.mockReset();
  matchRefereeStatusFindAllMock.mockReset();
  matchRefereeNotificationFindAllMock.mockReset();
  matchRefereeNotificationBulkCreateMock.mockReset();
  matchRefereeNotificationUpdateMock.mockReset();
  refereeRoleGroupFindByPkMock.mockReset();
  refereeRoleGroupFindAllMock.mockReset();
  refereeRoleFindAllMock.mockReset();
  tournamentTeamFindAllMock.mockReset();
  userFindAllMock.mockReset();
  seasonFindOneMock.mockReset();
  competitionTypeFindAllMock.mockReset();
  leaguesAccessFindAllMock.mockReset();
  listForUsersMock.mockReset();
  transactionMock.mockClear();
  matchRefereeStatusFindAllMock.mockResolvedValue([
    draftStatus,
    publishedStatus,
    confirmedStatus,
  ]);
  refereeRoleGroupFindByPkMock.mockResolvedValue(makeRoleGroup());
  refereeRoleGroupFindAllMock.mockResolvedValue([makeRoleGroup()]);
  refereeRoleFindAllMock.mockResolvedValue([]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);
  seasonFindOneMock.mockResolvedValue({ id: 'season-active' });
  competitionTypeFindAllMock.mockResolvedValue([]);
  leaguesAccessFindAllMock.mockResolvedValue([]);
});

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: transactionMock },
}));

jest.unstable_mockModule('../src/services/userAvailabilityService.js', () => ({
  __esModule: true,
  listForUsers: listForUsersMock,
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findAll: matchFindAllMock, findByPk: matchFindByPkMock },
  Team: {},
  Club: {},
  Ground: {},
  Tournament: {},
  CompetitionType: { findAll: competitionTypeFindAllMock },
  Stage: {},
  TournamentGroup: {},
  TournamentTeam: { findAll: tournamentTeamFindAllMock },
  Tour: {},
  Season: { findOne: seasonFindOneMock },
  RefereeRole: { findAll: refereeRoleFindAllMock },
  RefereeRoleGroup: {
    findByPk: refereeRoleGroupFindByPkMock,
    findAll: refereeRoleGroupFindAllMock,
  },
  TournamentGroupReferee: { findAll: tournamentGroupRefereeFindAllMock },
  MatchReferee: {
    findAll: matchRefereeFindAllMock,
    destroy: matchRefereeDestroyMock,
    bulkCreate: matchRefereeBulkCreateMock,
    update: matchRefereeUpdateMock,
  },
  MatchRefereeDraftClear: {
    findAll: matchRefereeDraftClearFindAllMock,
    findOrCreate: matchRefereeDraftClearFindOrCreateMock,
    update: matchRefereeDraftClearUpdateMock,
    destroy: matchRefereeDraftClearDestroyMock,
  },
  MatchRefereeStatus: { findAll: matchRefereeStatusFindAllMock },
  MatchRefereeNotification: {
    findAll: matchRefereeNotificationFindAllMock,
    bulkCreate: matchRefereeNotificationBulkCreateMock,
    update: matchRefereeNotificationUpdateMock,
  },
  GameStatus: {},
  Address: {},
  User: { findAll: userFindAllMock },
  Role: {},
  UserStatus: {},
  LeaguesAccess: { findAll: leaguesAccessFindAllMock },
}));

const service = await import('../src/services/refereeAssignmentService.js');

const draftStatus = { id: 'status-draft', alias: 'DRAFT' };
const publishedStatus = { id: 'status-published', alias: 'PUBLISHED' };
const confirmedStatus = { id: 'status-confirmed', alias: 'CONFIRMED' };
const TEST_DATE = '2099-02-10';
const TEST_DATE_NEXT = '2099-02-11';
const TEST_DATE_START = new Date(`${TEST_DATE}T09:00:00Z`);
const TEST_DATE_NEXT_START = new Date(`${TEST_DATE_NEXT}T09:00:00Z`);

function makeRoleGroup(overrides = {}) {
  return {
    id: overrides.id || 'rg1',
    name: overrides.name || 'Судьи в поле',
    sort_order: overrides.sort_order ?? 1,
  };
}

function makeRole(group, overrides = {}) {
  return {
    id: overrides.id || 'r1',
    name: overrides.name || 'Главный судья',
    sort_order: overrides.sort_order ?? 1,
    referee_role_group_id: group.id,
    RefereeRoleGroup: group,
  };
}

function expectWhereToContainClause(where, clause) {
  if (where?.[Op.or]) {
    expect(where[Op.or]).toEqual(
      expect.arrayContaining([expect.objectContaining(clause)])
    );
    return;
  }
  expect(where).toEqual(expect.objectContaining(clause));
}

function makeMatch(overrides = {}) {
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(overrides, key);
  const tournamentGroupId = hasOwn('tournament_group_id')
    ? overrides.tournament_group_id
    : 'tg1';
  const tournamentGroup = hasOwn('TournamentGroup')
    ? overrides.TournamentGroup
    : {
        id: 'tg1',
        name: 'Группа А',
        match_duration_minutes: overrides.match_duration_minutes ?? 30,
      };
  const tournament = hasOwn('Tournament')
    ? overrides.Tournament
    : {
        id: 't1',
        name: 'Кубок',
        CompetitionType: { id: 'ct-youth', alias: 'YOUTH' },
      };
  return {
    id: overrides.id || 'm1',
    date_start: overrides.date_start || TEST_DATE_START,
    tournament_id: overrides.tournament_id || 't1',
    team1_id: overrides.team1_id || 'team1',
    team2_id: overrides.team2_id || 'team2',
    tournament_group_id: tournamentGroupId,
    Tournament: tournament,
    Stage: { id: 's1', name: 'Этап 1' },
    TournamentGroup: tournamentGroup,
    Tour: { id: 'tour1', name: '1 тур' },
    Ground: {
      id: 'g1',
      name: 'Арена',
      yandex_url: 'https://yandex.ru',
      Address: { result: 'ул. Спортивная, 1' },
    },
    HomeTeam: {
      id: 'team1',
      name: 'Команда 1',
      birth_year: 2012,
      Club: { name: 'Клуб 1' },
    },
    AwayTeam: {
      id: 'team2',
      name: 'Команда 2',
      birth_year: 2012,
      Club: { name: 'Клуб 2' },
    },
  };
}

function makeAssignment(status = 'DRAFT') {
  const group = makeRoleGroup();
  const role = makeRole(group);
  const statusRow =
    status === 'DRAFT'
      ? draftStatus
      : status === 'CONFIRMED'
        ? confirmedStatus
        : publishedStatus;
  return {
    id: 'a1',
    match_id: 'm1',
    status_id: statusRow.id,
    MatchRefereeStatus: statusRow,
    RefereeRole: role,
    User: {
      id: 'u1',
      last_name: 'Иванов',
      first_name: 'Иван',
      patronymic: 'Иванович',
    },
  };
}

test('listMatchesByDate maps requirements and assignments', async () => {
  matchFindAllMock.mockResolvedValue([makeMatch()]);
  const group = makeRoleGroup();
  const role = makeRole(group);
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg1',
      count: 2,
      RefereeRole: role,
    },
  ]);
  matchRefereeFindAllMock.mockResolvedValue([
    makeAssignment('DRAFT'),
    { ...makeAssignment('PUBLISHED'), id: 'a2' },
  ]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

  const result = await service.listMatchesByDate(TEST_DATE);
  expect(result.matches).toHaveLength(1);
  const match = result.matches[0];
  expect(match.msk_start_time).toBe('12:00');
  expect(match.msk_end_time).toBe('12:30');
  expect(match.has_draft).toBe(true);
  expect(match.has_published).toBe(true);
  expect(match.draft_versions_by_group).toEqual(
    expect.objectContaining({ rg1: expect.stringMatching(/^v1-/) })
  );
  expect(match.referee_requirements[0].roles[0]).toEqual(
    expect.objectContaining({ id: 'r1', count: 2 })
  );
});

test('listMatchesByDate derives group context for manual match without tournament_group_id', async () => {
  matchFindAllMock.mockResolvedValue([
    makeMatch({
      id: 'm-manual',
      tournament_group_id: null,
      TournamentGroup: null,
    }),
  ]);
  tournamentTeamFindAllMock.mockResolvedValue([
    {
      tournament_id: 't1',
      team_id: 'team1',
      tournament_group_id: 'tg-manual',
      TournamentGroup: {
        id: 'tg-manual',
        name: 'Ручная группа',
        match_duration_minutes: 40,
      },
    },
  ]);
  const group = makeRoleGroup();
  const role = makeRole(group);
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg-manual',
      count: 1,
      referee_role_id: 'r1',
      RefereeRole: role,
    },
  ]);
  matchRefereeFindAllMock.mockResolvedValue([]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

  const result = await service.listMatchesByDate(TEST_DATE);

  expect(tournamentTeamFindAllMock).toHaveBeenCalled();
  expect(result.matches).toHaveLength(1);
  const match = result.matches[0];
  expect(match.group).toEqual({
    id: 'tg-manual',
    name: 'Ручная группа',
  });
  expect(match.duration_minutes).toBe(40);
  expect(match.duration_missing).toBe(false);
  expect(match.referee_requirements[0].id).toBe('rg1');
});

test('listRefereesByDate applies leagues access filter for active season', async () => {
  competitionTypeFindAllMock.mockResolvedValue([{ id: 'ct-pro' }]);
  leaguesAccessFindAllMock.mockResolvedValue([{ user_id: 'u2' }]);
  userFindAllMock.mockResolvedValue([
    {
      id: 'u2',
      last_name: 'Петров',
      first_name: 'Пётр',
      patronymic: 'Петрович',
      Roles: [{ alias: 'BRIGADE_REFEREE' }],
      UserStatus: { alias: 'ACTIVE' },
    },
  ]);
  listForUsersMock.mockResolvedValue([
    {
      user_id: 'u2',
      date: TEST_DATE,
      AvailabilityType: { alias: 'FREE' },
      from_time: null,
      to_time: null,
    },
  ]);

  const result = await service.listRefereesByDate({
    date: TEST_DATE,
    onlyLeaguesAccess: true,
    competitionAlias: 'PRO',
    limit: 0,
  });

  expect(seasonFindOneMock).toHaveBeenCalledWith(
    expect.objectContaining({ where: { active: true } })
  );
  expect(leaguesAccessFindAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        season_id: 'season-active',
        competition_type_id: { [Op.in]: ['ct-pro'] },
      },
    })
  );
  expect(userFindAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: { [Op.in]: ['u2'] },
      }),
    })
  );
  expect(result.referees).toHaveLength(1);
  expect(result.referees[0].id).toBe('u2');
});

test('listRefereesByDate keeps busy referees for pro leadership group', async () => {
  const leadershipGroup = makeRoleGroup({
    id: 'rg-lead',
    name: 'Руководство',
  });
  refereeRoleGroupFindByPkMock.mockResolvedValue(leadershipGroup);
  userFindAllMock.mockResolvedValue([
    {
      id: 'u3',
      last_name: 'Сидоров',
      first_name: 'Сидор',
      patronymic: 'Сидорович',
      Roles: [{ alias: 'BRIGADE_REFEREE' }],
      UserStatus: { alias: 'ACTIVE' },
    },
  ]);
  listForUsersMock.mockResolvedValue([
    {
      user_id: 'u3',
      date: TEST_DATE,
      AvailabilityType: { alias: 'BUSY' },
      from_time: null,
      to_time: null,
    },
  ]);

  const result = await service.listRefereesByDate({
    date: TEST_DATE,
    competitionAlias: 'PRO',
    roleGroupId: leadershipGroup.id,
  });

  expect(refereeRoleGroupFindByPkMock).toHaveBeenCalledWith(
    leadershipGroup.id,
    expect.objectContaining({ attributes: ['id', 'name'] })
  );
  expect(result.referees).toHaveLength(1);
  expect(result.referees[0].availability.status).toBe('BUSY');
});

test('listRefereesByDate strict mode keeps only referees with explicit preset on selected date', async () => {
  userFindAllMock.mockResolvedValue([
    {
      id: 'u1',
      last_name: 'Иванов',
      first_name: 'Иван',
      patronymic: 'Иванович',
      Roles: [{ alias: 'REFEREE' }],
      UserStatus: { alias: 'ACTIVE' },
    },
    {
      id: 'u2',
      last_name: 'Петров',
      first_name: 'Пётр',
      patronymic: 'Петрович',
      Roles: [{ alias: 'REFEREE' }],
      UserStatus: { alias: 'ACTIVE' },
    },
  ]);
  listForUsersMock.mockResolvedValue([
    {
      user_id: 'u1',
      date: TEST_DATE,
      AvailabilityType: { alias: 'FREE' },
      from_time: null,
      to_time: null,
    },
  ]);

  const result = await service.listRefereesByDate({
    date: TEST_DATE,
    requirePresetForDate: true,
  });

  expect(result.referees).toHaveLength(1);
  expect(result.referees[0].id).toBe('u1');
});

test('listRefereesByDate default mode keeps backward-compatible availability behavior', async () => {
  userFindAllMock.mockResolvedValue([
    {
      id: 'u1',
      last_name: 'Иванов',
      first_name: 'Иван',
      patronymic: 'Иванович',
      Roles: [{ alias: 'REFEREE' }],
      UserStatus: { alias: 'ACTIVE' },
    },
    {
      id: 'u2',
      last_name: 'Петров',
      first_name: 'Пётр',
      patronymic: 'Петрович',
      Roles: [{ alias: 'REFEREE' }],
      UserStatus: { alias: 'ACTIVE' },
    },
  ]);
  listForUsersMock.mockResolvedValue([
    {
      user_id: 'u1',
      date: TEST_DATE,
      AvailabilityType: { alias: 'FREE' },
      from_time: null,
      to_time: null,
    },
  ]);

  const result = await service.listRefereesByDate({
    date: TEST_DATE,
  });

  expect(result.referees).toHaveLength(2);
  expect(result.referees.map((item) => item.id)).toEqual(['u1', 'u2']);
});

test('listRefereesByDate can ignore availability filter for selected date', async () => {
  userFindAllMock.mockResolvedValue([
    {
      id: 'u1',
      last_name: 'Иванов',
      first_name: 'Иван',
      patronymic: 'Иванович',
      Roles: [{ alias: 'REFEREE' }],
      UserStatus: { alias: 'ACTIVE' },
    },
    {
      id: 'u2',
      last_name: 'Петров',
      first_name: 'Пётр',
      patronymic: 'Петрович',
      Roles: [{ alias: 'REFEREE' }],
      UserStatus: { alias: 'ACTIVE' },
    },
  ]);
  listForUsersMock.mockResolvedValue([
    {
      user_id: 'u1',
      date: TEST_DATE,
      AvailabilityType: { alias: 'BUSY' },
      from_time: null,
      to_time: null,
    },
  ]);

  const result = await service.listRefereesByDate({
    date: TEST_DATE,
    ignoreAvailabilityForDate: true,
  });

  expect(result.referees).toHaveLength(2);
  expect(result.referees.map((item) => item.id)).toEqual(['u1', 'u2']);
  expect(result.referees[0].availability_by_date?.[TEST_DATE]).toEqual(
    expect.objectContaining({
      status: 'BUSY',
      preset: true,
    })
  );
});

test('updateMatchReferees saves draft assignments', async () => {
  matchFindByPkMock.mockResolvedValue(
    makeMatch({ match_duration_minutes: 60 })
  );
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    { tournament_group_id: 'tg1', referee_role_id: 'r1', count: 1 },
  ]);
  userFindAllMock.mockResolvedValue([
    {
      id: 'u1',
      Roles: [{ alias: 'REFEREE' }],
      UserStatus: { alias: 'ACTIVE' },
    },
  ]);
  listForUsersMock.mockResolvedValue([
    { user_id: 'u1', AvailabilityType: { alias: 'FREE' } },
  ]);
  matchRefereeFindAllMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([makeAssignment('DRAFT')]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

  const result = await service.updateMatchReferees(
    'm1',
    [{ role_id: 'r1', user_id: 'u1' }],
    'admin',
    { roleGroupId: 'rg1' }
  );

  expect(matchRefereeDestroyMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        match_id: 'm1',
        status_id: draftStatus.id,
      }),
    })
  );
  expect(matchRefereeBulkCreateMock).toHaveBeenCalledWith(
    [
      expect.objectContaining({
        match_id: 'm1',
        referee_role_id: 'r1',
        user_id: 'u1',
        status_id: draftStatus.id,
      }),
    ],
    expect.objectContaining({ transaction: expect.any(Object) })
  );
  expect(result.assignments[0].status).toBe('DRAFT');
  expect(result.draft_clear_group_ids).toEqual([]);
});

test('updateMatchReferees uses fallback tournament group for manual match', async () => {
  matchFindByPkMock.mockResolvedValue(
    makeMatch({
      id: 'm-manual',
      tournament_group_id: null,
      TournamentGroup: null,
    })
  );
  tournamentTeamFindAllMock.mockResolvedValue([
    {
      tournament_id: 't1',
      team_id: 'team1',
      tournament_group_id: 'tg-fallback',
      TournamentGroup: {
        id: 'tg-fallback',
        name: 'Группа fallback',
        match_duration_minutes: 60,
      },
    },
  ]);
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    { tournament_group_id: 'tg-fallback', referee_role_id: 'r1', count: 1 },
  ]);
  userFindAllMock.mockResolvedValue([
    {
      id: 'u1',
      Roles: [{ alias: 'REFEREE' }],
      UserStatus: { alias: 'ACTIVE' },
    },
  ]);
  listForUsersMock.mockResolvedValue([
    { user_id: 'u1', AvailabilityType: { alias: 'FREE' } },
  ]);
  matchRefereeFindAllMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

  await service.updateMatchReferees(
    'm-manual',
    [{ role_id: 'r1', user_id: 'u1' }],
    'admin',
    { roleGroupId: 'rg1' }
  );

  expect(tournamentGroupRefereeFindAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { tournament_group_id: 'tg-fallback' },
    })
  );
});

test('updateMatchReferees rejects unavailable referees', async () => {
  matchFindByPkMock.mockResolvedValue(makeMatch());
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    { tournament_group_id: 'tg1', referee_role_id: 'r1', count: 1 },
  ]);
  userFindAllMock.mockResolvedValue([
    {
      id: 'u1',
      Roles: [{ alias: 'REFEREE' }],
      UserStatus: { alias: 'ACTIVE' },
    },
  ]);
  listForUsersMock.mockResolvedValue([
    { user_id: 'u1', AvailabilityType: { alias: 'BUSY' } },
  ]);
  matchRefereeFindAllMock.mockResolvedValueOnce([]);

  await expect(
    service.updateMatchReferees(
      'm1',
      [{ role_id: 'r1', user_id: 'u1' }],
      'admin',
      { roleGroupId: 'rg1' }
    )
  ).rejects.toMatchObject({ code: 'referee_unavailable' });
});

test('updateMatchReferees allows unavailable referees for past matches', async () => {
  jest
    .useFakeTimers()
    .setSystemTime(new Date(`${TEST_DATE_NEXT}T09:00:00+03:00`));
  try {
    matchFindByPkMock.mockResolvedValue(makeMatch());
    tournamentGroupRefereeFindAllMock.mockResolvedValue([
      { tournament_group_id: 'tg1', referee_role_id: 'r1', count: 1 },
    ]);
    userFindAllMock.mockResolvedValue([
      {
        id: 'u1',
        Roles: [{ alias: 'REFEREE' }],
        UserStatus: { alias: 'ACTIVE' },
      },
    ]);
    listForUsersMock.mockResolvedValue([
      { user_id: 'u1', AvailabilityType: { alias: 'BUSY' } },
    ]);
    matchRefereeFindAllMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeAssignment('DRAFT')]);
    matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

    const result = await service.updateMatchReferees(
      'm1',
      [{ role_id: 'r1', user_id: 'u1' }],
      'admin',
      { roleGroupId: 'rg1' }
    );

    expect(listForUsersMock).not.toHaveBeenCalled();
    expect(matchRefereeBulkCreateMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          match_id: 'm1',
          referee_role_id: 'r1',
          user_id: 'u1',
          status_id: draftStatus.id,
        }),
      ],
      expect.objectContaining({ transaction: expect.any(Object) })
    );
    expect(result.assignments[0].status).toBe('DRAFT');
  } finally {
    jest.useRealTimers();
  }
});

test('updateMatchReferees skips availability checks for pro leadership assignments', async () => {
  const leadershipGroup = makeRoleGroup({
    id: 'rg-lead',
    name: 'Руководство',
  });
  const leadershipRole = makeRole(leadershipGroup, {
    id: 'r-lead',
    name: 'Инспектор матча',
  });
  refereeRoleGroupFindByPkMock.mockResolvedValue(leadershipGroup);
  matchFindByPkMock.mockResolvedValue(
    makeMatch({
      match_duration_minutes: 60,
      Tournament: {
        id: 't1',
        name: 'Кубок',
        CompetitionType: { id: 'ct-pro', alias: 'PRO' },
      },
    })
  );
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg1',
      referee_role_id: leadershipRole.id,
      count: 1,
    },
  ]);
  userFindAllMock.mockResolvedValue([
    {
      id: 'u1',
      Roles: [{ alias: 'REFEREE' }],
      UserStatus: { alias: 'ACTIVE' },
    },
  ]);
  listForUsersMock.mockResolvedValue([
    { user_id: 'u1', AvailabilityType: { alias: 'BUSY' } },
  ]);
  matchRefereeFindAllMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
    {
      ...makeAssignment('DRAFT'),
      referee_role_id: leadershipRole.id,
      status_id: draftStatus.id,
      RefereeRole: leadershipRole,
      MatchRefereeStatus: draftStatus,
      user_id: 'u1',
    },
  ]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

  const result = await service.updateMatchReferees(
    'm1',
    [{ role_id: leadershipRole.id, user_id: 'u1' }],
    'admin',
    { roleGroupId: leadershipGroup.id }
  );

  expect(listForUsersMock).not.toHaveBeenCalled();
  expect(result.assignments[0].status).toBe('DRAFT');
});

test('updateMatchReferees allows occupied users for pro leadership assignments', async () => {
  const leadershipGroup = makeRoleGroup({
    id: 'rg-lead',
    name: 'Руководство',
  });
  const fieldGroup = makeRoleGroup({ id: 'rg-field', name: 'Судьи в поле' });
  const leadershipRole = makeRole(leadershipGroup, {
    id: 'r-lead',
    name: 'Инспектор матча',
  });
  const fieldRole = makeRole(fieldGroup, { id: 'r-field', name: 'Главный' });
  refereeRoleGroupFindByPkMock.mockResolvedValue(leadershipGroup);
  matchFindByPkMock.mockResolvedValue(
    makeMatch({
      Tournament: {
        id: 't1',
        name: 'Кубок',
        CompetitionType: { id: 'ct-pro', alias: 'PRO' },
      },
    })
  );
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg1',
      referee_role_id: leadershipRole.id,
      count: 1,
    },
  ]);
  matchRefereeFindAllMock
    .mockResolvedValueOnce([
      {
        match_id: 'm1',
        referee_role_id: fieldRole.id,
        user_id: 'u1',
        status_id: publishedStatus.id,
        RefereeRole: fieldRole,
      },
    ])
    .mockResolvedValueOnce([
      {
        ...makeAssignment('PUBLISHED'),
        id: 'a1',
        referee_role_id: fieldRole.id,
        status_id: publishedStatus.id,
        RefereeRole: fieldRole,
        MatchRefereeStatus: publishedStatus,
        user_id: 'u1',
      },
      {
        ...makeAssignment('DRAFT'),
        id: 'a2',
        referee_role_id: leadershipRole.id,
        status_id: draftStatus.id,
        RefereeRole: leadershipRole,
        MatchRefereeStatus: draftStatus,
        user_id: 'u1',
      },
    ]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

  const result = await service.updateMatchReferees(
    'm1',
    [{ role_id: leadershipRole.id, user_id: 'u1' }],
    'admin',
    { roleGroupId: leadershipGroup.id }
  );

  expect(result.assignments).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        role: expect.objectContaining({ id: leadershipRole.id }),
      }),
    ])
  );
});

test('updateMatchReferees stores clear marker when clearing assignments', async () => {
  matchFindByPkMock.mockResolvedValue(makeMatch());
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    { tournament_group_id: 'tg1', referee_role_id: 'r1', count: 1 },
  ]);
  matchRefereeFindAllMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([
    { referee_role_group_id: 'rg1' },
  ]);
  matchRefereeDraftClearFindOrCreateMock.mockResolvedValue([{}, true]);
  matchRefereeDraftClearUpdateMock.mockResolvedValue([1]);

  const result = await service.updateMatchReferees('m1', [], 'admin', {
    roleGroupId: 'rg1',
    clearPublished: true,
  });

  expect(matchRefereeDraftClearFindOrCreateMock).toHaveBeenCalled();
  expect(matchRefereeDraftClearDestroyMock).not.toHaveBeenCalled();
  expect(result.draft_clear_group_ids).toEqual(['rg1']);
});

test('updateMatchReferees returns conflict on stale draft version', async () => {
  const group = makeRoleGroup({ id: 'rg1' });
  const role = makeRole(group, { id: 'r1' });
  matchFindByPkMock.mockResolvedValue(makeMatch());
  matchRefereeFindAllMock.mockResolvedValue([
    {
      id: 'a-current',
      match_id: 'm1',
      referee_role_id: role.id,
      user_id: 'u-current',
      status_id: draftStatus.id,
      RefereeRole: role,
      MatchRefereeStatus: draftStatus,
    },
  ]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

  await expect(
    service.updateMatchReferees(
      'm1',
      [{ role_id: role.id, user_id: 'u-next' }],
      'admin',
      {
        roleGroupId: group.id,
        expectedDraftVersion: 'v1-stale-version',
      }
    )
  ).rejects.toMatchObject({
    code: 'referee_assignments_conflict',
    status: 409,
  });
  expect(matchRefereeFindAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.arrayContaining([
        expect.objectContaining({
          attributes: ['id', 'last_name', 'first_name', 'patronymic'],
        }),
      ]),
    })
  );
  expect(tournamentGroupRefereeFindAllMock).not.toHaveBeenCalled();
});

test('publishMatchReferees requires full slot coverage', async () => {
  matchFindByPkMock.mockResolvedValue(makeMatch());
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    { tournament_group_id: 'tg1', referee_role_id: 'r1', count: 2 },
  ]);
  matchRefereeFindAllMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { match_id: 'm1', referee_role_id: 'r1', status_id: draftStatus.id },
    ]);

  await expect(
    service.publishMatchReferees('m1', 'admin')
  ).rejects.toMatchObject({ code: 'referee_assignments_incomplete' });
});

test('publishMatchReferees promotes draft assignments', async () => {
  matchFindByPkMock.mockResolvedValue(makeMatch());
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    { tournament_group_id: 'tg1', referee_role_id: 'r1', count: 1 },
  ]);
  matchRefereeFindAllMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { match_id: 'm1', referee_role_id: 'r1', status_id: draftStatus.id },
    ])
    .mockResolvedValueOnce([makeAssignment('PUBLISHED')]);

  const result = await service.publishMatchReferees('m1', 'admin');

  expect(matchRefereeDestroyMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { match_id: 'm1', status_id: publishedStatus.id },
    })
  );
  expect(matchRefereeUpdateMock).toHaveBeenCalledWith(
    expect.objectContaining({ status_id: publishedStatus.id }),
    expect.objectContaining({
      where: { match_id: 'm1', status_id: draftStatus.id },
      transaction: expect.any(Object),
    })
  );
  expect(result.assignments[0].status).toBe('PUBLISHED');
});

test('publishMatchReferees auto-confirms pro leadership drafts without notifications', async () => {
  const leadershipGroup = makeRoleGroup({
    id: 'rg-lead',
    name: 'Руководство',
  });
  const leadershipRole = makeRole(leadershipGroup, {
    id: 'r-lead',
    name: 'Инспектор матча',
  });
  matchFindByPkMock.mockResolvedValue(
    makeMatch({
      Tournament: {
        id: 't1',
        name: 'Кубок',
        CompetitionType: { id: 'ct-pro', alias: 'PRO' },
      },
    })
  );
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg1',
      referee_role_id: leadershipRole.id,
      count: 1,
    },
  ]);
  matchRefereeFindAllMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        match_id: 'm1',
        referee_role_id: leadershipRole.id,
        status_id: draftStatus.id,
        RefereeRole: leadershipRole,
      },
    ])
    .mockResolvedValueOnce([
      {
        ...makeAssignment('CONFIRMED'),
        referee_role_id: leadershipRole.id,
        status_id: confirmedStatus.id,
        RefereeRole: leadershipRole,
        MatchRefereeStatus: confirmedStatus,
      },
    ])
    .mockResolvedValueOnce([]);

  const result = await service.publishMatchReferees('m1', 'admin');

  expect(matchRefereeUpdateMock).toHaveBeenCalledWith(
    expect.objectContaining({ status_id: confirmedStatus.id }),
    expect.objectContaining({
      where: expect.objectContaining({
        match_id: 'm1',
        status_id: draftStatus.id,
        referee_role_id: { [Op.in]: [leadershipRole.id] },
      }),
      transaction: expect.any(Object),
    })
  );
  expect(result.assignments[0].status).toBe('CONFIRMED');
  expect(result.notifications).toEqual(
    expect.objectContaining({
      queued: 0,
      published: 0,
      cancelled: 0,
    })
  );
});

test('publishMatchReferees applies clear markers even without drafts', async () => {
  const group = makeRoleGroup({ id: 'rg1', name: 'Судьи в поле' });
  const role = makeRole(group, { id: 'r1' });
  matchFindByPkMock.mockResolvedValue(makeMatch());
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg1',
      referee_role_id: role.id,
      count: 1,
      RefereeRole: role,
    },
  ]);
  matchRefereeFindAllMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([
    { referee_role_group_id: group.id },
  ]);

  const result = await service.publishMatchReferees('m1', 'admin');

  expect(matchRefereeDestroyMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        match_id: 'm1',
        referee_role_id: { [Op.in]: [role.id] },
        status_id: {
          [Op.in]: [draftStatus.id, publishedStatus.id, confirmedStatus.id],
        },
      }),
      force: true,
      transaction: expect.any(Object),
    })
  );
  expect(matchRefereeDraftClearDestroyMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        match_id: 'm1',
        referee_role_group_id: { [Op.in]: [group.id] },
      }),
      force: true,
      transaction: expect.any(Object),
    })
  );
  expect(result.assignments).toEqual([]);
});

test('publishMatchReferees keeps omission as cleared when another role stays in draft', async () => {
  const group = makeRoleGroup({ id: 'rg1', name: 'Судьи в поле' });
  const mainRole = makeRole(group, { id: 'r1', name: 'Главный судья' });
  const lineRole = makeRole(group, { id: 'r2', name: 'Линейный судья' });
  matchFindByPkMock.mockResolvedValue(makeMatch());
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg1',
      referee_role_id: mainRole.id,
      count: 1,
      RefereeRole: mainRole,
    },
    {
      tournament_group_id: 'tg1',
      referee_role_id: lineRole.id,
      count: 1,
      RefereeRole: lineRole,
    },
  ]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);
  matchRefereeFindAllMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        match_id: 'm1',
        referee_role_id: lineRole.id,
        user_id: 'u2',
        status_id: draftStatus.id,
        RefereeRole: lineRole,
      },
    ])
    .mockResolvedValueOnce([
      {
        ...makeAssignment('PUBLISHED'),
        referee_role_id: lineRole.id,
        RefereeRole: lineRole,
        MatchRefereeStatus: publishedStatus,
        User: {
          id: 'u2',
          last_name: 'Петров',
          first_name: 'Пётр',
          patronymic: 'Петрович',
        },
      },
    ])
    .mockResolvedValueOnce([]);

  const result = await service.publishMatchReferees('m1', 'admin', {
    allowIncomplete: true,
  });

  expect(matchRefereeDestroyMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { match_id: 'm1', status_id: publishedStatus.id },
    })
  );
  expect(result.assignments).toHaveLength(1);
  expect(result.assignments[0]).toEqual(
    expect.objectContaining({
      role: expect.objectContaining({ id: lineRole.id }),
      user: expect.objectContaining({ id: 'u2' }),
    })
  );
});

test('publishAssignmentsForDate publishes drafts for a role group', async () => {
  matchFindAllMock.mockResolvedValue([makeMatch()]);
  const group = makeRoleGroup();
  const role = makeRole(group);
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg1',
      referee_role_id: 'r1',
      count: 1,
      RefereeRole: role,
    },
  ]);
  matchRefereeFindAllMock.mockResolvedValue([
    {
      match_id: 'm1',
      referee_role_id: 'r1',
      user_id: 'u1',
      status_id: draftStatus.id,
    },
    {
      match_id: 'm1',
      referee_role_id: 'r1',
      user_id: 'u2',
      status_id: publishedStatus.id,
    },
  ]);

  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

  const result = await service.publishAssignmentsForDate(TEST_DATE, 'admin', {
    roleGroupIds: ['rg1'],
  });

  const destroyCall = matchRefereeDestroyMock.mock.calls[0]?.[0] || {};
  expect(destroyCall).toEqual(expect.objectContaining({ force: true }));
  expectWhereToContainClause(destroyCall.where, {
    match_id: 'm1',
    referee_role_id: 'r1',
    user_id: { [Op.in]: ['u2'] },
    status_id: { [Op.in]: [publishedStatus.id, confirmedStatus.id] },
  });
  const publishUpdateCall = matchRefereeUpdateMock.mock.calls.find(
    ([payload]) => payload?.status_id === publishedStatus.id
  );
  expect(publishUpdateCall).toBeDefined();
  expectWhereToContainClause(publishUpdateCall[1]?.where, {
    match_id: 'm1',
    referee_role_id: 'r1',
    user_id: { [Op.in]: ['u1'] },
    status_id: draftStatus.id,
  });
  expect(publishUpdateCall[1]).toEqual(
    expect.objectContaining({
      transaction: expect.any(Object),
    })
  );
  expect(result.published_matches).toEqual(['m1']);
});

test('publishAssignmentsForDate auto-confirms pro leadership drafts', async () => {
  const leadershipGroup = makeRoleGroup({
    id: 'rg-lead',
    name: 'Руководство',
  });
  const leadershipRole = makeRole(leadershipGroup, {
    id: 'r-lead',
    name: 'Инспектор матча',
  });
  refereeRoleGroupFindAllMock.mockResolvedValue([leadershipGroup]);
  matchFindAllMock.mockResolvedValue([
    makeMatch({
      Tournament: {
        id: 't1',
        name: 'Кубок',
        CompetitionType: { id: 'ct-pro', alias: 'PRO' },
      },
    }),
  ]);
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg1',
      referee_role_id: leadershipRole.id,
      count: 1,
      RefereeRole: leadershipRole,
    },
  ]);
  matchRefereeFindAllMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        match_id: 'm1',
        referee_role_id: leadershipRole.id,
        user_id: 'u1',
        status_id: draftStatus.id,
      },
    ])
    .mockResolvedValueOnce([]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

  const result = await service.publishAssignmentsForDate(TEST_DATE, 'admin', {
    roleGroupIds: [leadershipGroup.id],
  });

  const confirmUpdateCall = matchRefereeUpdateMock.mock.calls.find(
    ([payload]) => payload?.status_id === confirmedStatus.id
  );
  expect(confirmUpdateCall).toBeDefined();
  expectWhereToContainClause(confirmUpdateCall[1]?.where, {
    match_id: 'm1',
    referee_role_id: leadershipRole.id,
    user_id: { [Op.in]: ['u1'] },
    status_id: draftStatus.id,
  });
  expect(confirmUpdateCall[1]).toEqual(
    expect.objectContaining({
      transaction: expect.any(Object),
    })
  );
  expect(result.notifications).toEqual(
    expect.objectContaining({
      queued: 0,
      published: 0,
      cancelled: 0,
    })
  );
});

test('publishAssignmentsForDate publishes available drafts despite gaps', async () => {
  matchFindAllMock.mockResolvedValue([makeMatch()]);
  const group = makeRoleGroup();
  const role = makeRole(group);
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg1',
      referee_role_id: 'r1',
      count: 2,
      RefereeRole: role,
    },
  ]);
  matchRefereeFindAllMock.mockResolvedValue([
    {
      match_id: 'm1',
      referee_role_id: 'r1',
      user_id: 'u1',
      status_id: draftStatus.id,
    },
  ]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

  const result = await service.publishAssignmentsForDate(TEST_DATE, 'admin', {
    roleGroupIds: ['rg1'],
  });

  const publishUpdateCall = matchRefereeUpdateMock.mock.calls.find(
    ([payload]) => payload?.status_id === publishedStatus.id
  );
  expect(publishUpdateCall).toBeDefined();
  expectWhereToContainClause(publishUpdateCall[1]?.where, {
    match_id: 'm1',
    referee_role_id: 'r1',
    user_id: { [Op.in]: ['u1'] },
    status_id: draftStatus.id,
  });
  expect(publishUpdateCall[1]).toEqual(
    expect.objectContaining({
      transaction: expect.any(Object),
    })
  );
  expect(result.published_matches).toEqual(['m1']);
});

test('publishAssignmentsForDate rejects incomplete drafts in strict mode', async () => {
  matchFindAllMock.mockResolvedValue([makeMatch()]);
  const group = makeRoleGroup();
  const role = makeRole(group);
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg1',
      referee_role_id: 'r1',
      count: 2,
      RefereeRole: role,
    },
  ]);
  matchRefereeFindAllMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
    {
      match_id: 'm1',
      referee_role_id: 'r1',
      user_id: 'u1',
      status_id: draftStatus.id,
    },
  ]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

  await expect(
    service.publishAssignmentsForDate(TEST_DATE, 'admin', {
      roleGroupIds: ['rg1'],
      allowIncomplete: false,
    })
  ).rejects.toMatchObject({
    code: 'referee_assignments_incomplete',
    details: {
      incomplete_summary: expect.objectContaining({
        incomplete_matches: 1,
      }),
    },
  });
  expect(matchRefereeUpdateMock).not.toHaveBeenCalled();
});

test('publishAssignmentsForDate clears published when draft clear exists', async () => {
  matchFindAllMock.mockResolvedValue([makeMatch()]);
  const group = makeRoleGroup();
  const role = makeRole(group);
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg1',
      referee_role_id: 'r1',
      count: 1,
      RefereeRole: role,
    },
  ]);
  matchRefereeFindAllMock.mockResolvedValue([]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([
    { match_id: 'm1', referee_role_group_id: 'rg1' },
  ]);

  const result = await service.publishAssignmentsForDate(TEST_DATE, 'admin', {
    roleGroupIds: ['rg1'],
  });

  const destroyCall = matchRefereeDestroyMock.mock.calls[0]?.[0] || {};
  expect(destroyCall).toEqual(expect.objectContaining({ force: true }));
  expectWhereToContainClause(destroyCall.where, {
    match_id: 'm1',
    referee_role_id: { [Op.in]: ['r1'] },
    status_id: {
      [Op.in]: [draftStatus.id, publishedStatus.id, confirmedStatus.id],
    },
  });
  expect(matchRefereeDraftClearDestroyMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        match_id: { [Op.in]: ['m1'] },
        referee_role_group_id: 'rg1',
      }),
      force: true,
    })
  );
  expect(result.published_matches).toEqual(['m1']);
});

test('publishAssignmentsForDate clears omitted role while publishing another role', async () => {
  matchFindAllMock.mockResolvedValue([makeMatch()]);
  const group = makeRoleGroup({ id: 'rg1', name: 'Судьи в поле' });
  const mainRole = makeRole(group, { id: 'r1', name: 'Главный судья' });
  const lineRole = makeRole(group, { id: 'r2', name: 'Линейный судья' });
  tournamentGroupRefereeFindAllMock.mockResolvedValue([
    {
      tournament_group_id: 'tg1',
      referee_role_id: mainRole.id,
      count: 1,
      RefereeRole: mainRole,
    },
    {
      tournament_group_id: 'tg1',
      referee_role_id: lineRole.id,
      count: 1,
      RefereeRole: lineRole,
    },
  ]);
  matchRefereeFindAllMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        match_id: 'm1',
        referee_role_id: mainRole.id,
        user_id: 'u1',
        status_id: publishedStatus.id,
      },
      {
        match_id: 'm1',
        referee_role_id: lineRole.id,
        user_id: 'u2',
        status_id: draftStatus.id,
      },
    ])
    .mockResolvedValueOnce([]);
  matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

  const result = await service.publishAssignmentsForDate(TEST_DATE, 'admin', {
    roleGroupIds: ['rg1'],
    allowIncomplete: true,
  });

  const clearByOmissionCall = matchRefereeDestroyMock.mock.calls
    .map((call) => call[0])
    .find((args) => {
      const clauses = args?.where?.[Op.or];
      if (!Array.isArray(clauses)) return false;
      return clauses.some(
        (clause) => clause.match_id === 'm1' && clause.referee_role_id === 'r1'
      );
    });
  expect(clearByOmissionCall).toBeDefined();
  expectWhereToContainClause(clearByOmissionCall.where, {
    match_id: 'm1',
    referee_role_id: 'r1',
    user_id: { [Op.in]: ['u1'] },
    status_id: { [Op.in]: [publishedStatus.id, confirmedStatus.id] },
  });
  const publishUpdateCall = matchRefereeUpdateMock.mock.calls.find(
    ([payload]) => payload?.status_id === publishedStatus.id
  );
  expect(publishUpdateCall).toBeDefined();
  expectWhereToContainClause(publishUpdateCall[1]?.where, {
    match_id: 'm1',
    referee_role_id: lineRole.id,
    user_id: { [Op.in]: ['u2'] },
    status_id: draftStatus.id,
  });
  expect(result.published_matches).toEqual(['m1']);
  expect(result.notifications).toEqual(
    expect.objectContaining({
      queued: expect.any(Number),
      cancelled: expect.any(Number),
    })
  );
});

test('publishAssignmentsForDate auto-confirms past-date changes without notifications', async () => {
  jest
    .useFakeTimers()
    .setSystemTime(new Date(`${TEST_DATE_NEXT}T09:00:00+03:00`));
  try {
    matchFindAllMock.mockResolvedValue([makeMatch()]);
    const group = makeRoleGroup({ id: 'rg1', name: 'Судьи в поле' });
    const role = makeRole(group, { id: 'r1', name: 'Главный судья' });
    tournamentGroupRefereeFindAllMock.mockResolvedValue([
      {
        tournament_group_id: 'tg1',
        referee_role_id: role.id,
        count: 1,
        RefereeRole: role,
      },
    ]);
    matchRefereeFindAllMock.mockResolvedValue([
      {
        match_id: 'm1',
        referee_role_id: role.id,
        user_id: 'u1',
        status_id: publishedStatus.id,
      },
      {
        match_id: 'm1',
        referee_role_id: role.id,
        user_id: 'u1',
        status_id: draftStatus.id,
      },
    ]);
    matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

    const result = await service.publishAssignmentsForDate(TEST_DATE, 'admin', {
      roleGroupIds: ['rg1'],
    });

    const confirmPublishedCall = matchRefereeUpdateMock.mock.calls.find(
      ([payload, options]) =>
        payload?.status_id === confirmedStatus.id &&
        options?.where?.[Op.or]?.some(
          (clause) =>
            clause.match_id === 'm1' &&
            clause.referee_role_id === role.id &&
            clause.status_id === publishedStatus.id
        )
    );
    expect(confirmPublishedCall).toBeDefined();
    expect(result.published_matches).toEqual(['m1']);
    expect(result.notifications).toEqual({
      recipients: 0,
      queued: 0,
      failed: 0,
      published: 0,
      cancelled: 0,
      skipped_no_email: 0,
      skipped_duplicate: 0,
    });
    expect(matchRefereeNotificationBulkCreateMock).not.toHaveBeenCalled();
    expect(matchRefereeNotificationUpdateMock).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test('publishAssignmentsForDate keeps past-date publication working without confirmed status', async () => {
  jest
    .useFakeTimers()
    .setSystemTime(new Date(`${TEST_DATE_NEXT}T09:00:00+03:00`));
  try {
    matchRefereeStatusFindAllMock.mockResolvedValue([
      draftStatus,
      publishedStatus,
    ]);
    matchFindAllMock.mockResolvedValue([makeMatch()]);
    const group = makeRoleGroup({ id: 'rg1', name: 'Судьи в поле' });
    const role = makeRole(group, { id: 'r1', name: 'Главный судья' });
    tournamentGroupRefereeFindAllMock.mockResolvedValue([
      {
        tournament_group_id: 'tg1',
        referee_role_id: role.id,
        count: 1,
        RefereeRole: role,
      },
    ]);
    matchRefereeFindAllMock.mockResolvedValue([
      {
        match_id: 'm1',
        referee_role_id: role.id,
        user_id: 'u1',
        status_id: draftStatus.id,
      },
    ]);
    matchRefereeDraftClearFindAllMock.mockResolvedValue([]);

    const result = await service.publishAssignmentsForDate(TEST_DATE, 'admin', {
      roleGroupIds: ['rg1'],
    });

    const publishUpdateCall = matchRefereeUpdateMock.mock.calls.find(
      ([payload]) => payload?.status_id === publishedStatus.id
    );
    expect(publishUpdateCall).toBeDefined();
    expect(result.published_matches).toEqual(['m1']);
    expect(result.notifications).toEqual({
      recipients: 0,
      queued: 0,
      failed: 0,
      published: 0,
      cancelled: 0,
      skipped_no_email: 0,
      skipped_duplicate: 0,
    });
  } finally {
    jest.useRealTimers();
  }
});

test('listAssignmentsForUser returns published assignments grouped by match', async () => {
  matchRefereeFindAllMock
    .mockResolvedValueOnce([
      {
        ...makeAssignment('PUBLISHED'),
        MatchRefereeStatus: publishedStatus,
        RefereeRole: makeRole(makeRoleGroup()),
        Match: makeMatch(),
      },
    ])
    .mockResolvedValueOnce([
      {
        ...makeAssignment('PUBLISHED'),
        MatchRefereeStatus: publishedStatus,
        RefereeRole: makeRole(makeRoleGroup()),
        User: makeAssignment('PUBLISHED').User,
      },
    ]);

  const result = await service.listAssignmentsForUser('u1', TEST_DATE);

  expect(result.matches).toHaveLength(1);
  const match = result.matches[0];
  expect(match.msk_start_time).toBe('12:00');
  expect(match.msk_end_time).toBe('12:30');
  expect(match.assignments[0]).toEqual(
    expect.objectContaining({ status: 'PUBLISHED' })
  );
  expect(result.day_summary).toEqual({
    total: 1,
    published: 1,
    confirmed: 0,
    needs_confirmation: true,
  });
});

test('listAssignmentsForUser includes mixed day summary for confirmed and published', async () => {
  matchRefereeFindAllMock
    .mockResolvedValueOnce([
      {
        ...makeAssignment('PUBLISHED'),
        MatchRefereeStatus: publishedStatus,
        RefereeRole: makeRole(makeRoleGroup()),
        Match: makeMatch(),
      },
      {
        ...makeAssignment('CONFIRMED'),
        id: 'a2',
        match_id: 'm2',
        MatchRefereeStatus: confirmedStatus,
        RefereeRole: makeRole(makeRoleGroup()),
        Match: makeMatch({
          id: 'm2',
          date_start: new Date(`${TEST_DATE}T12:00:00Z`),
        }),
      },
    ])
    .mockResolvedValueOnce([
      {
        ...makeAssignment('PUBLISHED'),
        MatchRefereeStatus: publishedStatus,
        RefereeRole: makeRole(makeRoleGroup()),
        User: makeAssignment('PUBLISHED').User,
      },
      {
        ...makeAssignment('CONFIRMED'),
        id: 'a2',
        match_id: 'm2',
        MatchRefereeStatus: confirmedStatus,
        RefereeRole: makeRole(makeRoleGroup()),
        User: makeAssignment('PUBLISHED').User,
      },
    ]);

  const result = await service.listAssignmentsForUser('u1', TEST_DATE);

  expect(result.day_summary).toEqual({
    total: 2,
    published: 1,
    confirmed: 1,
    needs_confirmation: true,
  });
});

test('listAssignmentDatesForUser groups assignments by day', async () => {
  matchRefereeFindAllMock.mockResolvedValue([
    {
      match_id: 'm1',
      status_id: publishedStatus.id,
      Match: makeMatch(),
    },
    {
      match_id: 'm2',
      status_id: confirmedStatus.id,
      Match: makeMatch({
        id: 'm2',
        date_start: TEST_DATE_NEXT_START,
      }),
    },
  ]);

  const result = await service.listAssignmentDatesForUser('u1');

  expect(result.dates).toEqual([
    expect.objectContaining({ date: TEST_DATE, total: 1, published: 1 }),
    expect.objectContaining({ date: TEST_DATE_NEXT, total: 1, confirmed: 1 }),
  ]);
});

test('listAssignmentsForUser keeps past day hidden in self-flow', async () => {
  const result = await service.listAssignmentsForUser('u1', '2000-01-01');

  expect(matchRefereeFindAllMock).not.toHaveBeenCalled();
  expect(result).toEqual({
    date: '2000-01-01',
    matches: [],
    day_summary: {
      total: 0,
      published: 0,
      confirmed: 0,
      needs_confirmation: false,
    },
  });
});

test('confirmAssignmentsForDate updates published assignments for day', async () => {
  matchRefereeFindAllMock.mockResolvedValue([
    { match_id: 'm1', status_id: publishedStatus.id, Match: { id: 'm1' } },
  ]);

  const result = await service.confirmAssignmentsForDate(TEST_DATE, 'u1');

  expect(matchRefereeUpdateMock).toHaveBeenCalledWith(
    expect.objectContaining({ status_id: confirmedStatus.id }),
    expect.objectContaining({
      where: expect.objectContaining({
        user_id: 'u1',
        status_id: publishedStatus.id,
      }),
    })
  );
  expect(result.confirmed_matches).toEqual(['m1']);
});

test('confirmAssignmentsForDate fails when day has no assignments at all', async () => {
  matchRefereeFindAllMock.mockResolvedValue([]);

  await expect(
    service.confirmAssignmentsForDate(TEST_DATE, 'u1')
  ).rejects.toMatchObject({ code: 'referee_assignments_missing' });
});

test('confirmAssignmentsForDate is idempotent for already confirmed day', async () => {
  matchRefereeFindAllMock.mockResolvedValue([
    { match_id: 'm1', status_id: confirmedStatus.id, Match: { id: 'm1' } },
  ]);

  const result = await service.confirmAssignmentsForDate(TEST_DATE, 'u1');

  expect(matchRefereeUpdateMock).not.toHaveBeenCalled();
  expect(result).toEqual(
    expect.objectContaining({
      confirmed_count: 0,
      already_confirmed: true,
      confirmed_matches: [],
    })
  );
});

test('confirmAssignmentsForMatch updates published assignments', async () => {
  matchRefereeFindAllMock
    .mockResolvedValueOnce([
      {
        ...makeAssignment('PUBLISHED'),
        status_id: publishedStatus.id,
        MatchRefereeStatus: publishedStatus,
      },
    ])
    .mockResolvedValueOnce([
      {
        ...makeAssignment('CONFIRMED'),
        status_id: confirmedStatus.id,
        MatchRefereeStatus: confirmedStatus,
      },
    ]);

  const result = await service.confirmAssignmentsForMatch('m1', 'u1');

  expect(matchRefereeUpdateMock).toHaveBeenCalledWith(
    expect.objectContaining({ status_id: confirmedStatus.id }),
    expect.objectContaining({
      where: expect.objectContaining({
        match_id: 'm1',
        user_id: 'u1',
        status_id: publishedStatus.id,
      }),
    })
  );
  expect(result.assignments[0].status).toBe('CONFIRMED');
});

test('confirmAssignmentsForMatch fails without assignments', async () => {
  matchRefereeFindAllMock.mockResolvedValue([]);

  await expect(
    service.confirmAssignmentsForMatch('m1', 'u1')
  ).rejects.toMatchObject({ code: 'referee_assignments_missing' });
});
