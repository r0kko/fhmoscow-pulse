import { beforeEach, expect, jest, test } from '@jest/globals';

// Mocks: lightweight in-memory rows
const now = new Date('2025-05-10T06:00:00.000Z');
jest.useFakeTimers().setSystemTime(now);

const matchFindAllMock = jest.fn();
const matchAgreementFindAllMock = jest.fn();
const updateMock = jest.fn();
const teamFindAllMock = jest.fn();
const userClubFindAllMock = jest.fn();
const listUsersForTeamsMock = jest.fn();
const sendDigestMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findAll: matchFindAllMock },
  MatchAgreement: { findAll: matchAgreementFindAllMock, update: updateMock },
  MatchAgreementStatus: { findOne: async ({ where }) => ({ id: where.alias }) },
  MatchAgreementType: {
    findAll: async () => [
      { id: 'HOME_PROPOSAL', alias: 'HOME_PROPOSAL' },
      { id: 'AWAY_COUNTER', alias: 'AWAY_COUNTER' },
    ],
  },
  Team: { findAll: teamFindAllMock },
  Ground: {},
  Tournament: {},
  TournamentGroup: {},
  Tour: {},
  GameStatus: {},
  UserClub: { findAll: userClubFindAllMock },
  SportSchoolPosition: {},
}));

jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  listUsersForTeams: (teamIds) => listUsersForTeamsMock(teamIds),
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendMatchAgreementDailyDigestEmail: (u, d) => sendDigestMock(u, d),
  },
  sendMatchAgreementDailyDigestEmail: (u, d) => sendDigestMock(u, d),
}));

const { runMatchAgreementReminders } = await import(
  '../src/jobs/matchAgreementReminderCron.js'
);

beforeEach(() => {
  matchFindAllMock.mockReset();
  matchAgreementFindAllMock.mockReset();
  updateMock.mockReset();
  teamFindAllMock.mockReset();
  userClubFindAllMock.mockReset();
  listUsersForTeamsMock.mockReset();
  sendDigestMock.mockReset();
});

test('aggregates per team: assign (no proposals) and decide (>24h pending) with single digest', async () => {
  const msk9 = new Date('2025-05-10T06:00:00.000Z'); // 09:00 MSK
  // Matches: two for home team H1, one has no pending (d=3), second has PENDING (>24h) type HOME_PROPOSAL
  const match1 = {
    id: 'm1',
    date_start: new Date('2025-05-13T12:00:00Z'),
    ground_id: null,
    team1_id: 'H1',
    team2_id: 'A1',
    HomeTeam: { name: 'H1' },
    AwayTeam: { name: 'A1' },
    Tournament: { name: 'Cup' },
    TournamentGroup: null,
    Tour: null,
    Ground: null,
    GameStatus: { alias: 'SCHEDULED' },
  };
  const match2 = {
    id: 'm2',
    date_start: new Date('2025-05-12T12:00:00Z'),
    ground_id: null,
    team1_id: 'H1',
    team2_id: 'A2',
    HomeTeam: { name: 'H1' },
    AwayTeam: { name: 'A2' },
    Tournament: null,
    TournamentGroup: null,
    Tour: null,
    Ground: null,
    GameStatus: { alias: 'SCHEDULED' },
  };
  // First call: Match.findAll
  matchFindAllMock.mockResolvedValueOnce([match1, match2]);
  // Then MatchAgreement.findAll for PENDING
  const dayBefore = new Date(msk9.getTime() - 30 * 60 * 60 * 1000); // 30h ago
  matchAgreementFindAllMock.mockImplementationOnce(async () => [
    {
      id: 'agr2',
      match_id: 'm2',
      type_id: 'AWAY_COUNTER',
      ground_id: null,
      date_start: match2.date_start,
      created_at: dayBefore,
      decision_reminded_at: null,
    },
  ]);
  // Then MatchAgreement.findAll for ACCEPTED
  matchAgreementFindAllMock.mockImplementationOnce(async () => []);

  teamFindAllMock.mockResolvedValueOnce([
    { id: 'H1', name: 'H1', club_id: 'club1' },
  ]);
  userClubFindAllMock.mockResolvedValueOnce([]);
  listUsersForTeamsMock.mockResolvedValue(
    new Map([
      [
        'H1',
        [
          {
            id: 'u1',
            email: 'x@x',
          },
        ],
      ],
    ])
  );

  await runMatchAgreementReminders();

  expect(sendDigestMock).toHaveBeenCalledTimes(1);
  const [, digest] = sendDigestMock.mock.calls[0];
  expect(digest.totals.assign).toBe(1);
  expect(digest.totals.decide).toBe(1);
  expect(Array.isArray(digest.teams)).toBe(true);
  expect(digest.teams).toHaveLength(1);
  expect(digest.teams[0].assign).toHaveLength(1);
  expect(digest.teams[0].decide).toHaveLength(1);
  expect(updateMock).toHaveBeenCalled();
});

test('aggregates multiple teams for one user into a single digest email', async () => {
  const matchTeam1 = {
    id: 'mt1',
    date_start: new Date('2025-05-15T12:00:00Z'),
    ground_id: null,
    team1_id: 'T1',
    team2_id: 'X1',
    HomeTeam: { name: 'Team 1' },
    AwayTeam: { name: 'Opponent 1' },
    Tournament: null,
    TournamentGroup: null,
    Tour: null,
    Ground: null,
    GameStatus: { alias: 'SCHEDULED' },
  };
  const matchTeam2 = {
    id: 'mt2',
    date_start: new Date('2025-05-16T12:00:00Z'),
    ground_id: null,
    team1_id: 'T2',
    team2_id: 'X2',
    HomeTeam: { name: 'Team 2' },
    AwayTeam: { name: 'Opponent 2' },
    Tournament: null,
    TournamentGroup: null,
    Tour: null,
    Ground: null,
    GameStatus: { alias: 'SCHEDULED' },
  };

  matchFindAllMock.mockResolvedValueOnce([matchTeam1, matchTeam2]);
  matchAgreementFindAllMock.mockImplementationOnce(async () => []);
  matchAgreementFindAllMock.mockImplementationOnce(async () => []);

  teamFindAllMock.mockResolvedValueOnce([
    { id: 'T1', name: 'Team 1', club_id: 'club1' },
    { id: 'T2', name: 'Team 2', club_id: 'club2' },
  ]);
  userClubFindAllMock.mockResolvedValueOnce([]);
  listUsersForTeamsMock.mockResolvedValue(
    new Map([
      ['T1', [{ id: 'uShared', email: 'shared@club' }]],
      ['T2', [{ id: 'uShared', email: 'shared@club' }]],
    ])
  );

  await runMatchAgreementReminders();

  expect(sendDigestMock).toHaveBeenCalledTimes(1);
  const [user, digest] = sendDigestMock.mock.calls[0];
  expect(user.email).toBe('shared@club');
  expect(digest.teams).toHaveLength(2);
  expect(digest.teams.map((t) => t.teamId).sort()).toEqual(['T1', 'T2']);
  expect(digest.totals.assign).toBe(2);
  expect(digest.totals.decide).toBe(0);
  expect(updateMock).not.toHaveBeenCalled();
});

test('filters recipients by sport school position rules', async () => {
  const matchClub1 = {
    id: 'mc1',
    date_start: new Date('2025-05-12T12:00:00Z'),
    ground_id: null,
    team1_id: 'CL1',
    team2_id: 'Opp1',
    HomeTeam: { name: 'Club One' },
    AwayTeam: { name: 'Opponent' },
    Tournament: null,
    TournamentGroup: null,
    Tour: null,
    Ground: null,
    GameStatus: { alias: 'SCHEDULED' },
  };
  const matchClub2 = {
    id: 'mc2',
    date_start: new Date('2025-05-13T12:00:00Z'),
    ground_id: null,
    team1_id: 'CL2',
    team2_id: 'Opp2',
    HomeTeam: { name: 'Club Two' },
    AwayTeam: { name: 'Opponent 2' },
    Tournament: null,
    TournamentGroup: null,
    Tour: null,
    Ground: null,
    GameStatus: { alias: 'SCHEDULED' },
  };

  matchFindAllMock.mockResolvedValueOnce([matchClub1, matchClub2]);
  matchAgreementFindAllMock.mockImplementationOnce(async () => []);
  matchAgreementFindAllMock.mockImplementationOnce(async () => []);

  teamFindAllMock.mockResolvedValueOnce([
    { id: 'CL1', name: 'Club One', club_id: 'club1' },
    { id: 'CL2', name: 'Club Two', club_id: 'club2' },
  ]);
  userClubFindAllMock.mockResolvedValueOnce([
    { club_id: 'club1', user_id: 'uNoPos', SportSchoolPosition: null },
    {
      club_id: 'club1',
      user_id: 'uAdmin',
      SportSchoolPosition: { alias: 'ADMINISTRATOR' },
    },
    {
      club_id: 'club1',
      user_id: 'uMethodist',
      SportSchoolPosition: { alias: 'METHODIST' },
    },
    {
      club_id: 'club1',
      user_id: 'uDirectorSingle',
      SportSchoolPosition: { alias: 'DIRECTOR' },
    },
    {
      club_id: 'club1',
      user_id: 'uCoach',
      SportSchoolPosition: { alias: 'COACH' },
    },
    {
      club_id: 'club2',
      user_id: 'uDirectorA',
      SportSchoolPosition: { alias: 'DIRECTOR' },
    },
    {
      club_id: 'club2',
      user_id: 'uDirectorB',
      SportSchoolPosition: { alias: 'DIRECTOR' },
    },
  ]);
  listUsersForTeamsMock.mockResolvedValue(
    new Map([
      [
        'CL1',
        [
          { id: 'uNoPos', email: 'no@club1' },
          { id: 'uAdmin', email: 'admin@club1' },
          { id: 'uMethodist', email: 'methodist@club1' },
          { id: 'uDirectorSingle', email: 'director@club1' },
          { id: 'uCoach', email: 'coach@club1' },
        ],
      ],
      [
        'CL2',
        [
          { id: 'uDirectorA', email: 'dirA@club2' },
          { id: 'uDirectorB', email: 'dirB@club2' },
        ],
      ],
    ])
  );

  await runMatchAgreementReminders();

  expect(sendDigestMock).toHaveBeenCalledTimes(3);
  const recipients = sendDigestMock.mock.calls
    .map(([user]) => user.email)
    .sort();
  expect(recipients).toEqual(['admin@club1', 'methodist@club1', 'no@club1']);
  expect(recipients).not.toContain('coach@club1');
  expect(recipients).not.toContain('dirA@club2');
  expect(recipients).not.toContain('dirB@club2');
  expect(updateMock).not.toHaveBeenCalled();
});

test('sole director receives digest when no other staff exist', async () => {
  const matchSolo = {
    id: 'solo',
    date_start: new Date('2025-05-14T12:00:00Z'),
    ground_id: null,
    team1_id: 'TD',
    team2_id: 'OppSolo',
    HomeTeam: { name: 'Team Director' },
    AwayTeam: { name: 'Opponent' },
    Tournament: null,
    TournamentGroup: null,
    Tour: null,
    Ground: null,
    GameStatus: { alias: 'SCHEDULED' },
  };

  matchFindAllMock.mockResolvedValueOnce([matchSolo]);
  matchAgreementFindAllMock.mockImplementationOnce(async () => []);
  matchAgreementFindAllMock.mockImplementationOnce(async () => []);

  teamFindAllMock.mockResolvedValueOnce([
    { id: 'TD', name: 'Team Director', club_id: 'clubSolo' },
  ]);
  userClubFindAllMock.mockResolvedValueOnce([
    {
      club_id: 'clubSolo',
      user_id: 'uDirectorSolo',
      SportSchoolPosition: { alias: 'DIRECTOR' },
    },
  ]);
  listUsersForTeamsMock.mockResolvedValue(
    new Map([
      [
        'TD',
        [
          {
            id: 'uDirectorSolo',
            email: 'director@solo',
          },
        ],
      ],
    ])
  );

  await runMatchAgreementReminders();

  expect(sendDigestMock).toHaveBeenCalledTimes(1);
  const [user] = sendDigestMock.mock.calls[0];
  expect(user.email).toBe('director@solo');
});
