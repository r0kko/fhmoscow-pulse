import { beforeEach, expect, jest, test } from '@jest/globals';

// Mocks: lightweight in-memory rows
const now = new Date('2025-05-10T06:00:00.000Z');
jest.useFakeTimers().setSystemTime(now);

const findAllMock = jest.fn();
const updateMock = jest.fn();
const listTeamUsersMock = jest.fn();
const sendDigestMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findAll: findAllMock },
  MatchAgreement: { findAll: findAllMock, update: updateMock },
  MatchAgreementStatus: { findOne: async ({ where }) => ({ id: where.alias }) },
  MatchAgreementType: { findAll: async () => [{ id: 'HOME_PROPOSAL', alias: 'HOME_PROPOSAL' }, { id: 'AWAY_COUNTER', alias: 'AWAY_COUNTER' }] },
  Team: {},
  Ground: {},
  Tournament: {},
  TournamentGroup: {},
  Tour: {},
  GameStatus: {},
}));

jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  listTeamUsers: (teamId) => listTeamUsersMock(teamId),
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: { sendMatchAgreementDailyDigestEmail: (u, d) => sendDigestMock(u, d) },
  sendMatchAgreementDailyDigestEmail: (u, d) => sendDigestMock(u, d),
}));

const { runMatchAgreementReminders } = await import('../src/jobs/matchAgreementReminderCron.js');

beforeEach(() => {
  findAllMock.mockReset();
  updateMock.mockReset();
  listTeamUsersMock.mockReset();
  sendDigestMock.mockReset();
});

test('aggregates per team: assign (no proposals) and decide (>24h pending) with single digest', async () => {
  const msk9 = new Date('2025-05-10T06:00:00.000Z'); // 09:00 MSK
  // Matches: two for home team H1, one has no pending (d=3), second has PENDING (>24h) type HOME_PROPOSAL
  const match1 = { id: 'm1', date_start: new Date('2025-05-13T12:00:00Z'), ground_id: null, team1_id: 'H1', team2_id: 'A1', HomeTeam: { name: 'H1' }, AwayTeam: { name: 'A1' }, Tournament: { name: 'Cup' }, TournamentGroup: null, Tour: null, Ground: null, GameStatus: { alias: 'SCHEDULED' } };
  const match2 = { id: 'm2', date_start: new Date('2025-05-12T12:00:00Z'), ground_id: null, team1_id: 'H1', team2_id: 'A2', HomeTeam: { name: 'H1' }, AwayTeam: { name: 'A2' }, Tournament: null, TournamentGroup: null, Tour: null, Ground: null, GameStatus: { alias: 'SCHEDULED' } };
  // First call: Match.findAll
  findAllMock.mockImplementationOnce(async () => [match1, match2]);
  // Then MatchAgreement.findAll for PENDING
  const dayBefore = new Date(msk9.getTime() - 30 * 60 * 60 * 1000); // 30h ago
  findAllMock.mockImplementationOnce(async () => [
    { id: 'agr2', match_id: 'm2', type_id: 'AWAY_COUNTER', ground_id: null, date_start: match2.date_start, created_at: dayBefore, decision_reminded_at: null },
  ]);
  // Then MatchAgreement.findAll for ACCEPTED
  findAllMock.mockImplementationOnce(async () => []);

  listTeamUsersMock.mockResolvedValue([{ id: 'u1', email: 'x@x' }]);

  await runMatchAgreementReminders();

  expect(sendDigestMock).toHaveBeenCalledTimes(1);
  const [, digest] = sendDigestMock.mock.calls[0];
  expect(digest.assign.length).toBe(1); // m1
  expect(digest.decide.length).toBe(1); // m2
  expect(updateMock).toHaveBeenCalled();
});
