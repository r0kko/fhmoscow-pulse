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
const userFindAllMock = jest.fn();
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
  userFindAllMock.mockReset();
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
  Stage: {},
  TournamentGroup: {},
  Tour: {},
  Season: {},
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
}));

const service = await import('../src/services/refereeAssignmentService.js');

const draftStatus = { id: 'status-draft', alias: 'DRAFT' };
const publishedStatus = { id: 'status-published', alias: 'PUBLISHED' };
const confirmedStatus = { id: 'status-confirmed', alias: 'CONFIRMED' };

function makeRoleGroup() {
  return { id: 'rg1', name: 'Судьи в поле', sort_order: 1 };
}

function makeRole(group) {
  return {
    id: 'r1',
    name: 'Главный судья',
    sort_order: 1,
    referee_role_group_id: group.id,
    RefereeRoleGroup: group,
  };
}

function makeMatch(overrides = {}) {
  return {
    id: overrides.id || 'm1',
    date_start: overrides.date_start || new Date('2024-02-10T09:00:00Z'),
    tournament_group_id: overrides.tournament_group_id || 'tg1',
    Tournament: { id: 't1', name: 'Кубок' },
    Stage: { id: 's1', name: 'Этап 1' },
    TournamentGroup: {
      id: 'tg1',
      name: 'Группа А',
      match_duration_minutes: overrides.match_duration_minutes ?? 30,
    },
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

  const result = await service.listMatchesByDate('2024-02-10');
  expect(result.matches).toHaveLength(1);
  const match = result.matches[0];
  expect(match.msk_start_time).toBe('12:00');
  expect(match.msk_end_time).toBe('12:30');
  expect(match.has_draft).toBe(true);
  expect(match.has_published).toBe(true);
  expect(match.referee_requirements[0].roles[0]).toEqual(
    expect.objectContaining({ id: 'r1', count: 2 })
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

  const result = await service.publishAssignmentsForDate(
    '2024-02-10',
    'admin',
    {
      roleGroupIds: ['rg1'],
    }
  );

  expect(matchRefereeDestroyMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        match_id: 'm1',
        referee_role_id: 'r1',
        user_id: { [Op.in]: ['u2'] },
        status_id: { [Op.in]: [publishedStatus.id, confirmedStatus.id] },
      }),
      force: true,
    })
  );
  expect(matchRefereeUpdateMock).toHaveBeenCalledWith(
    expect.objectContaining({ status_id: publishedStatus.id }),
    expect.objectContaining({
      where: expect.objectContaining({
        match_id: 'm1',
        referee_role_id: 'r1',
        user_id: { [Op.in]: ['u1'] },
        status_id: draftStatus.id,
      }),
      transaction: expect.any(Object),
    })
  );
  expect(result.published_matches).toEqual(['m1']);
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

  const result = await service.publishAssignmentsForDate(
    '2024-02-10',
    'admin',
    {
      roleGroupIds: ['rg1'],
    }
  );

  expect(matchRefereeUpdateMock).toHaveBeenCalledWith(
    expect.objectContaining({ status_id: publishedStatus.id }),
    expect.objectContaining({
      where: expect.objectContaining({
        match_id: 'm1',
        referee_role_id: 'r1',
        user_id: { [Op.in]: ['u1'] },
        status_id: draftStatus.id,
      }),
      transaction: expect.any(Object),
    })
  );
  expect(result.published_matches).toEqual(['m1']);
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

  const result = await service.publishAssignmentsForDate(
    '2024-02-10',
    'admin',
    {
      roleGroupIds: ['rg1'],
    }
  );

  expect(matchRefereeDestroyMock).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        match_id: 'm1',
        referee_role_id: { [Op.in]: ['r1'] },
        status_id: {
          [Op.in]: [draftStatus.id, publishedStatus.id, confirmedStatus.id],
        },
      }),
      force: true,
    })
  );
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

  const result = await service.listAssignmentsForUser('u1', '2024-02-10');

  expect(result.matches).toHaveLength(1);
  const match = result.matches[0];
  expect(match.msk_start_time).toBe('12:00');
  expect(match.msk_end_time).toBe('12:30');
  expect(match.assignments[0]).toEqual(
    expect.objectContaining({ status: 'PUBLISHED' })
  );
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
        date_start: new Date('2024-02-11T09:00:00Z'),
      }),
    },
  ]);

  const result = await service.listAssignmentDatesForUser('u1');

  expect(result.dates).toEqual([
    expect.objectContaining({ date: '2024-02-10', total: 1, published: 1 }),
    expect.objectContaining({ date: '2024-02-11', total: 1, confirmed: 1 }),
  ]);
});

test('confirmAssignmentsForDate updates published assignments for day', async () => {
  matchRefereeFindAllMock.mockResolvedValue([
    { match_id: 'm1', status_id: publishedStatus.id, Match: { id: 'm1' } },
  ]);

  const result = await service.confirmAssignmentsForDate('2024-02-10', 'u1');

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

test('confirmAssignmentsForDate fails without published assignments', async () => {
  matchRefereeFindAllMock.mockResolvedValue([]);

  await expect(
    service.confirmAssignmentsForDate('2024-02-10', 'u1')
  ).rejects.toMatchObject({ code: 'referee_assignments_missing' });
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
