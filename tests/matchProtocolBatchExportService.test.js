import { afterAll, beforeEach, expect, jest, test } from '@jest/globals';

const participantFindAllMock = jest.fn();
const jobFindOneMock = jest.fn();
const jobCreateMock = jest.fn();
const itemBulkCreateMock = jest.fn();
const getParticipationSummaryMock = jest.fn();
const setImmediateMock = jest.spyOn(global, 'setImmediate');

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  File: {},
  GameStatus: {},
  Match: { findByPk: jest.fn() },
  MatchParticipantPlayer: { findAll: participantFindAllMock },
  MatchProtocolExportItem: {
    bulkCreate: itemBulkCreateMock,
    findAll: jest.fn(),
  },
  MatchProtocolExportJob: {
    create: jobCreateMock,
    findByPk: jest.fn(),
    findOne: jobFindOneMock,
    update: jest.fn(),
  },
  Player: {},
  Season: { findByPk: jest.fn() },
  Team: { findByPk: jest.fn() },
}));

jest.unstable_mockModule(
  '../src/services/teamParticipationSummaryService.js',
  () => ({
    __esModule: true,
    default: {
      getParticipationSummary: getParticipationSummaryMock,
    },
  })
);

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: {
    saveGeneratedArchiveFromPath: jest.fn(),
    getFileBuffer: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/matchProtocolService.js', () => ({
  __esModule: true,
  default: {
    renderHighlightedMatchProtocol: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/config/metrics.js', () => ({
  __esModule: true,
  incMatchProtocolExportJob: jest.fn(),
  incMatchProtocolExportRetry: jest.fn(),
  incMatchProtocolUpstreamRequest: jest.fn(),
  observeMatchProtocolExportDuration: jest.fn(),
}));

jest.unstable_mockModule('../src/utils/redisLock.js', () => ({
  __esModule: true,
  withRedisLock: jest.fn(async (_key, _ttl, fn) => fn()),
  buildJobLockKey: (name) => `lock:${name}`,
}));

jest.unstable_mockModule('../logger.js', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const service =
  await import('../src/services/matchProtocolBatchExportService.js');

function matchRow(id, externalId, date = '2026-04-20T10:00:00.000Z') {
  return {
    id,
    external_id: externalId,
    date_start: date,
    GameStatus: { alias: 'FINISHED' },
    HomeTeam: { name: 'Академия' },
    AwayTeam: { name: 'Динамо' },
  };
}

function participantRow(match, externalPlayerId, surname) {
  return {
    external_player_id: externalPlayerId,
    Match: match,
    Player: { surname, name: 'Игрок', patronymic: null },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  setImmediateMock.mockImplementation(() => null);
  jobFindOneMock.mockResolvedValue(null);
  jobCreateMock.mockImplementation(async (payload) => ({
    id: 'job-1',
    status: 'QUEUED',
    processed_matches: 0,
    success_count: 0,
    skipped_count: 0,
    failure_count: 0,
    archive_file_id: null,
    started_at: null,
    finished_at: null,
    error_code: null,
    ...payload,
  }));
  itemBulkCreateMock.mockResolvedValue([]);
  getParticipationSummaryMock.mockResolvedValue({
    players: [
      { id: 'player-1', external_player_id: 101, full_name: 'Первый' },
      { id: 'player-2', external_player_id: 102, full_name: 'Второй' },
    ],
  });
});

afterAll(() => {
  setImmediateMock.mockRestore();
});

test('denies access to team outside allowed scope', async () => {
  await expect(
    service.createExportJob({
      teamId: 'team-1',
      seasonId: 'season-1',
      playerIds: ['player-1'],
      access: { isAdmin: false, allowedTeamIds: ['team-2'] },
      actorId: 'user-1',
    })
  ).rejects.toMatchObject({ code: 'access_denied', status: 403 });

  expect(getParticipationSummaryMock).not.toHaveBeenCalled();
});

test('creates one queued item per participated match with all selected highlighted players', async () => {
  const match1 = matchRow('match-1', 501);
  const match2 = matchRow('match-2', 502, '2026-04-21T10:00:00.000Z');
  participantFindAllMock.mockResolvedValue([
    participantRow(match1, 101, 'Первый'),
    participantRow(match1, 102, 'Второй'),
    participantRow(match2, 101, 'Первый'),
  ]);

  const result = await service.createExportJob({
    teamId: 'team-1',
    seasonId: 'season-1',
    playerIds: ['player-1', 'player-2'],
    access: { isAdmin: true },
    actorId: 'user-1',
    requestId: 'req-1',
  });

  expect(result).toMatchObject({
    job_id: 'job-1',
    status: 'QUEUED',
    total_matches: 2,
    already_running: false,
  });
  expect(itemBulkCreateMock).toHaveBeenCalledWith([
    expect.objectContaining({
      match_id: 'match-1',
      external_match_id: 501,
      highlighted_external_player_ids: [101, 102],
    }),
    expect.objectContaining({
      match_id: 'match-2',
      external_match_id: 502,
      highlighted_external_player_ids: [101],
    }),
  ]);
});

test('reuses existing running job by fingerprint', async () => {
  jobFindOneMock.mockResolvedValue({
    id: 'job-existing',
    status: 'RUNNING',
    total_matches: 3,
    processed_matches: 1,
    success_count: 1,
    skipped_count: 0,
    failure_count: 0,
    archive_file_id: null,
    error_code: null,
    started_at: null,
    finished_at: null,
    expires_at: new Date(Date.now() + 60_000),
  });

  const result = await service.createExportJob({
    teamId: 'team-1',
    seasonId: 'season-1',
    playerIds: ['player-1'],
    access: { isAdmin: true },
    actorId: 'user-1',
  });

  expect(result).toMatchObject({
    job_id: 'job-existing',
    already_running: true,
  });
  expect(participantFindAllMock).not.toHaveBeenCalled();
  expect(itemBulkCreateMock).not.toHaveBeenCalled();
});
