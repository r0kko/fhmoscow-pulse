import { beforeEach, expect, jest, test } from '@jest/globals';

const calls = [];
const isExternalDbAvailableMock = jest.fn();
const connectExternalMariaDbMock = jest.fn();

jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
  __esModule: true,
  isExternalDbAvailable: () => isExternalDbAvailableMock(),
  connectExternalMariaDb: (...args) => connectExternalMariaDbMock(...args),
}));

jest.unstable_mockModule('../src/utils/redisLock.js', () => ({
  __esModule: true,
  buildJobLockKey: (job) => `lock:${job}`,
  withRedisLock: async (_key, _ttl, fn) => fn(),
}));

jest.unstable_mockModule('../src/config/metrics.js', () => ({
  __esModule: true,
  withJobMetrics: async (_job, fn) => fn(),
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

function mockJob(path, name) {
  jest.unstable_mockModule(path, () => ({
    __esModule: true,
    [name]: jest.fn(async () => {
      calls.push(name);
    }),
  }));
}

mockJob('../src/jobs/clubSyncCron.js', 'runClubSync');
mockJob('../src/jobs/groundSyncCron.js', 'runGroundSync');
mockJob('../src/jobs/teamSyncCron.js', 'runTeamSync');
mockJob('../src/jobs/staffSyncCron.js', 'runStaffSync');
mockJob('../src/jobs/playerSyncCron.js', 'runPlayerSync');
mockJob('../src/jobs/tournamentSyncCron.js', 'runTournamentSync');
mockJob('../src/jobs/matchParticipantSyncCron.js', 'runMatchParticipantSync');
mockJob('../src/jobs/gameEventTypeSyncCron.js', 'runGameEventTypeSync');
mockJob('../src/jobs/penaltyMinutesSyncCron.js', 'runPenaltyMinutesSync');
mockJob('../src/jobs/gameSituationSyncCron.js', 'runGameSituationSync');
mockJob('../src/jobs/gameViolationSyncCron.js', 'runGameViolationSync');
mockJob('../src/jobs/gamePenaltySyncCron.js', 'runGamePenaltySync');
mockJob('../src/jobs/broadcastLinkSyncCron.js', 'runBroadcastLinkSync');

const { runSyncAll, resetSyncAllState } =
  await import('../src/jobs/syncAllCron.js');

beforeEach(() => {
  calls.length = 0;
  resetSyncAllState();
  isExternalDbAvailableMock.mockReset().mockReturnValue(true);
  connectExternalMariaDbMock.mockReset();
});

test('runSyncAll runs match participant sync after tournaments and before dependent game jobs', async () => {
  await runSyncAll();

  expect(calls).toEqual([
    'runClubSync',
    'runGroundSync',
    'runTeamSync',
    'runStaffSync',
    'runPlayerSync',
    'runTournamentSync',
    'runMatchParticipantSync',
    'runGameEventTypeSync',
    'runPenaltyMinutesSync',
    'runGameSituationSync',
    'runGameViolationSync',
    'runGamePenaltySync',
    'runBroadcastLinkSync',
  ]);
});
