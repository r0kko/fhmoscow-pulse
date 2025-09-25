import { beforeEach, expect, jest, test, describe } from '@jest/globals';

const matchFindByPkMock = jest.fn();
const userFindByPkMock = jest.fn();
const groundFindByPkMock = jest.fn();
const groundFindAllMock = jest.fn();
const groundTeamFindOneMock = jest.fn();
const maStatusFindOneMock = jest.fn();
const maTypeFindOneMock = jest.fn();
const maCountMock = jest.fn();
const maCreateMock = jest.fn();
const maFindByPkMock = jest.fn();

const teamFindByPkMock = jest.fn();
const teamFindAllMock = jest.fn();

function makeUser({ teams = [], roles = [], clubs = [] } = {}) {
  return {
    Teams: teams,
    Roles: roles,
    UserClubs: clubs,
  };
}

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: async (fn) => fn({}) },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: matchFindByPkMock },
  User: { findByPk: userFindByPkMock },
  Ground: { findByPk: groundFindByPkMock, findAll: groundFindAllMock },
  GroundTeam: { findOne: groundTeamFindOneMock },
  MatchAgreementStatus: { findOne: maStatusFindOneMock },
  MatchAgreementType: { findOne: maTypeFindOneMock },
  MatchAgreement: {
    count: maCountMock,
    create: maCreateMock,
    findByPk: maFindByPkMock,
  },
  Team: { findByPk: teamFindByPkMock, findAll: teamFindAllMock },
  Role: {},
  UserClub: {},
  SportSchoolPosition: {},
  Club: {},
  Tournament: {},
  TournamentType: {},
  TournamentGroup: {},
  Tour: {},
  GameStatus: {},
}));

jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  listTeamUsers: jest.fn().mockResolvedValue([]),
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendMatchAgreementProposedEmail: jest.fn(),
    sendMatchAgreementCounterProposedEmail: jest.fn(),
    sendMatchAgreementWithdrawnEmail: jest.fn(),
    sendMatchAgreementApprovedEmail: jest.fn(),
    sendMatchAgreementDeclinedEmail: jest.fn(),
  },
}));

const svc = (await import('../src/services/matchAgreementService.js')).default;
const { listAvailableGrounds } = await import(
  '../src/services/matchAgreementService.js'
);

beforeEach(() => {
  matchFindByPkMock.mockReset();
  userFindByPkMock.mockReset();
  groundFindByPkMock.mockReset();
  groundFindAllMock.mockReset().mockResolvedValue([]);
  groundTeamFindOneMock.mockReset();
  maStatusFindOneMock.mockReset();
  maTypeFindOneMock.mockReset();
  maCountMock.mockReset();
  maCreateMock.mockReset();
  maFindByPkMock.mockReset();
  teamFindByPkMock.mockReset();
  teamFindAllMock.mockReset().mockResolvedValue([]);
});

describe('matchAgreementService.create edge cases', () => {
  test('initial proposal requires home side', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    matchFindByPkMock.mockResolvedValue({
      id: 'm1',
      date_start: future,
      team1_id: 't1',
      team2_id: 't2',
    });
    userFindByPkMock.mockResolvedValue(makeUser({ teams: [{ id: 't2' }] })); // not home
    groundFindByPkMock.mockResolvedValue({ id: 'g1' });
    await expect(
      svc.create('m1', { ground_id: 'g1', date_start: future }, 'actor')
    ).rejects.toMatchObject({ code: 'only_home_can_propose' });
  });

  test('counter-proposal requires pending parent and away side', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    matchFindByPkMock.mockResolvedValue({
      id: 'm2',
      date_start: future,
      team1_id: 't1',
      team2_id: 't2',
    });
    userFindByPkMock.mockResolvedValue(makeUser({ teams: [{ id: 't1' }] })); // home, not away
    groundFindByPkMock.mockResolvedValue({ id: 'g1' });
    maFindByPkMock.mockResolvedValue({
      id: 'p1',
      match_id: 'm2',
      MatchAgreementStatus: { alias: 'PENDING' },
      MatchAgreementType: { alias: 'HOME_PROPOSAL' },
    });
    await expect(
      svc.create(
        'm2',
        { ground_id: 'g1', date_start: future, parent_id: 'p1' },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'only_away_can_counter' });

    // parent not pending
    userFindByPkMock.mockResolvedValue(makeUser({ teams: [{ id: 't2' }] })); // away now
    maFindByPkMock.mockResolvedValue({
      id: 'p1',
      match_id: 'm2',
      MatchAgreementStatus: { alias: 'SUPERSEDED' },
      MatchAgreementType: { alias: 'HOME_PROPOSAL' },
    });
    await expect(
      svc.create(
        'm2',
        { ground_id: 'g1', date_start: future, parent_id: 'p1' },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'parent_not_pending' });
  });

  test('pending_agreement_exists prevents initial proposal', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    matchFindByPkMock.mockResolvedValue({
      id: 'm3',
      date_start: future,
      team1_id: 't1',
      team2_id: 't2',
    });
    userFindByPkMock.mockResolvedValue(makeUser({ teams: [{ id: 't1' }] })); // home
    groundFindByPkMock.mockResolvedValue({ id: 'g1' });
    groundTeamFindOneMock.mockResolvedValue({});
    maStatusFindOneMock.mockImplementation(({ where }) => {
      if (where.alias === 'ACCEPTED') return Promise.resolve({ id: 'st_acc' });
      if (where.alias === 'PENDING') return Promise.resolve({ id: 'st_pen' });
      return Promise.resolve(null);
    });
    // first count for ACCEPTED -> 0, second for PENDING -> 1
    maCountMock.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await expect(
      svc.create('m3', { ground_id: 'g1', date_start: future }, 'actor')
    ).rejects.toMatchObject({ code: 'pending_agreement_exists' });
  });

  test('staff coach cannot create agreements', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    matchFindByPkMock.mockResolvedValue({
      id: 'm_coach',
      date_start: future,
      team1_id: 't1',
      team2_id: 't2',
      schedule_locked_by_admin: false,
      GameStatus: { alias: 'SCHEDULED' },
      HomeTeam: { name: 'Home' },
      AwayTeam: { name: 'Away' },
      Tournament: { name: 'Cup', TournamentType: { double_protocol: false } },
      TournamentGroup: { name: 'A' },
      Tour: { name: '1' },
      Season: { name: '2024/25', active: true },
      Ground: { name: 'Arena', Address: {} },
      MatchBroadcastLinks: [],
    });
    teamFindAllMock.mockResolvedValue([
      { id: 't1', club_id: 'club_home' },
      { id: 't2', club_id: 'club_away' },
    ]);
    userFindByPkMock.mockResolvedValue(
      makeUser({
        teams: [{ id: 't1', club_id: 'club_home' }],
        roles: [{ alias: 'SPORT_SCHOOL_STAFF' }],
        clubs: [
          {
            club_id: 'club_home',
            SportSchoolPosition: { alias: 'COACH' },
          },
        ],
      })
    );

    await expect(
      svc.create(
        'm_coach',
        { ground_id: 'g1', date_start: future },
        'coach_user'
      )
    ).rejects.toMatchObject({ code: 'staff_position_restricted', status: 403 });
  });
});

test('staff accountant cannot list agreements', async () => {
  matchFindByPkMock.mockResolvedValue({
    id: 'm_list',
    team1_id: 't1',
    team2_id: 't2',
  });
  teamFindAllMock.mockResolvedValue([
    { id: 't1', club_id: 'club_home' },
    { id: 't2', club_id: 'club_away' },
  ]);
  userFindByPkMock.mockResolvedValue(
    makeUser({
      teams: [{ id: 't1', club_id: 'club_home' }],
      roles: [{ alias: 'SPORT_SCHOOL_STAFF' }],
      clubs: [
        {
          club_id: 'club_home',
          SportSchoolPosition: { alias: 'ACCOUNTANT' },
        },
      ],
    })
  );

  await expect(svc.list('m_list', 'accountant_user')).rejects.toMatchObject({
    code: 'staff_position_restricted',
    status: 403,
  });
});

test('staff media manager cannot list agreements', async () => {
  matchFindByPkMock.mockResolvedValue({
    id: 'm_media',
    team1_id: 't1',
    team2_id: 't2',
  });
  teamFindAllMock.mockResolvedValue([
    { id: 't1', club_id: 'club_home' },
    { id: 't2', club_id: 'club_away' },
  ]);
  userFindByPkMock.mockResolvedValue(
    makeUser({
      teams: [{ id: 't2', club_id: 'club_away' }],
      roles: [{ alias: 'SPORT_SCHOOL_STAFF' }],
      clubs: [
        {
          club_id: 'club_away',
          SportSchoolPosition: { alias: 'MEDIA_MANAGER' },
        },
      ],
    })
  );

  await expect(svc.list('m_media', 'media_user')).rejects.toMatchObject({
    code: 'staff_position_restricted',
    status: 403,
  });
});

describe('listAvailableGrounds edge cases', () => {
  test('returns empty when past or cancelled', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    matchFindByPkMock.mockResolvedValue({
      id: 'm4',
      date_start: past,
      team1_id: 't1',
      team2_id: 't2',
      GameStatus: { alias: 'SCHEDULED' },
    });
    userFindByPkMock.mockResolvedValue(makeUser({ teams: [{ id: 't1' }] }));
    const res1 = await listAvailableGrounds('m4', 'actor');
    expect(res1.grounds.length).toBe(0);

    const future = new Date(Date.now() + 86400000).toISOString();
    matchFindByPkMock.mockResolvedValue({
      id: 'm5',
      date_start: future,
      team1_id: 't1',
      team2_id: 't2',
      GameStatus: { alias: 'CANCELLED' },
    });
    userFindByPkMock.mockResolvedValue(makeUser({ teams: [{ id: 't1' }] }));
    const res2 = await listAvailableGrounds('m5', 'actor');
    expect(res2.grounds.length).toBe(0);
  });

  test('includes away grounds when Moscow rule applies', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    matchFindByPkMock.mockResolvedValue({
      id: 'm6',
      date_start: future,
      team1_id: 't1',
      team2_id: 't2',
      GameStatus: { alias: 'SCHEDULED' },
      HomeTeam: { Club: { id: 'c1', name: 'Home Club', is_moscow: false } },
      AwayTeam: { Club: { id: 'c2', name: 'Away Club', is_moscow: true } },
      Tournament: { TournamentType: { double_protocol: true } },
    });
    userFindByPkMock.mockResolvedValue(makeUser({ teams: [{ id: 't1' }] }));
    groundFindAllMock.mockImplementation(({ include }) => {
      const teamId = include?.[0]?.where?.id;
      if (teamId === 't1') return [{ id: 'g1', name: 'Home Arena' }];
      if (teamId === 't2') return [{ id: 'g2', name: 'Away Arena' }];
      return [];
    });

    const res = await listAvailableGrounds('m6', 'actor');

    expect(res.allow_guest_ground_selection).toBe(true);
    expect(res.groups).toHaveLength(2);
    expect(res.groups[0].club.name).toBe('Home Club');
    expect(res.groups[0].grounds[0]).toEqual({ id: 'g1', name: 'Home Arena' });
    expect(res.groups[1].club.name).toBe('Away Club');
    expect(res.groups[1].grounds[0]).toEqual({ id: 'g2', name: 'Away Arena' });
    expect(res.grounds).toEqual(res.groups[0].grounds);
  });
});
