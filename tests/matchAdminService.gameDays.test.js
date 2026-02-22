import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  jest,
  test,
} from '@jest/globals';
import { Op } from 'sequelize';

const matchFindAllMock = jest.fn();
const agreementFindAllMock = jest.fn();

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findAll: matchFindAllMock },
  Team: {},
  Club: {},
  Ground: {},
  Tournament: {},
  ScheduleManagementType: {},
  TournamentGroup: {},
  Tour: {},
  MatchAgreement: { findAll: agreementFindAllMock },
  MatchAgreementStatus: {},
  MatchAgreementType: {},
  GameStatus: {},
}));

const { listNextGameDays } =
  await import('../src/services/matchAdminService.js');

function makeLightMatch(id, isoDate) {
  return {
    id,
    date_start: new Date(isoDate),
  };
}

function makeMatch(id, isoDate, overrides = {}) {
  return {
    id,
    date_start: new Date(isoDate),
    score_team1: overrides.score1 ?? null,
    score_team2: overrides.score2 ?? null,
    technical_winner: overrides.technicalWinner ?? null,
    Ground: { name: overrides.stadium || 'Арена' },
    HomeTeam: {
      name: overrides.team1 || `Команда ${id}A`,
      Club: { name: overrides.homeClub || 'Клуб А' },
    },
    AwayTeam: {
      name: overrides.team2 || `Команда ${id}B`,
      Club: { name: overrides.awayClub || 'Клуб Б' },
    },
    Tournament: { name: overrides.tournament || 'Кубок' },
    TournamentGroup: { name: overrides.group || 'Группа' },
    Tour: { name: overrides.tour || '1 тур' },
    GameStatus: {
      name: overrides.statusName || 'Назначен',
      alias: overrides.statusAlias || 'SCHEDULED',
    },
  };
}

beforeAll(() => {
  jest.useFakeTimers().setSystemTime(new Date('2024-02-05T00:00:00Z'));
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  matchFindAllMock.mockReset();
  agreementFindAllMock.mockReset();
});

function expectValidRangeCall(callIndex = 0) {
  const args = matchFindAllMock.mock.calls[callIndex]?.[0];
  expect(args).toBeDefined();
  expect(args.where?.date_start?.[Op.gte]).toBeInstanceOf(Date);
  expect(args.where?.date_start?.[Op.lt]).toBeInstanceOf(Date);
  expect(
    args.where.date_start[Op.lt].getTime() >
      args.where.date_start[Op.gte].getTime()
  ).toBe(true);
}

test('listNextGameDays supports forward direction with custom anchor and two-phase loading', async () => {
  matchFindAllMock
    .mockResolvedValueOnce([
      makeLightMatch('m1', '2024-02-09T09:00:00Z'),
      makeLightMatch('m2', '2024-02-10T10:15:00Z'),
      makeLightMatch('m3', '2024-02-11T11:30:00Z'),
    ])
    .mockResolvedValueOnce([
      makeMatch('m2', '2024-02-10T10:15:00Z', { score1: 1, score2: 0 }),
      makeMatch('m3', '2024-02-11T11:30:00Z', {
        score1: 2,
        score2: 2,
        technicalWinner: 'home',
      }),
    ]);
  agreementFindAllMock.mockResolvedValue([
    { match_id: 'm3', MatchAgreementStatus: { alias: 'ACCEPTED' } },
  ]);

  const result = await listNextGameDays({
    count: 2,
    horizonDays: 7,
    anchorDate: '2024-02-10',
    direction: 'forward',
  });

  expect(matchFindAllMock).toHaveBeenCalledTimes(2);
  expectValidRangeCall(0);
  expect(matchFindAllMock.mock.calls[0][0].attributes).toEqual([
    'id',
    'date_start',
  ]);
  expect(matchFindAllMock.mock.calls[1][0].where).toEqual(
    expect.objectContaining({ id: { [Op.in]: ['m2', 'm3'] } })
  );
  expect(result.game_days).toEqual([
    '2024-02-10T00:00:00.000Z',
    '2024-02-11T00:00:00.000Z',
  ]);
  expect(result.meta).toEqual({
    attention_days: 7,
    search_max_len: 80,
    direction: 'forward',
  });
  expect(result.day_tabs).toEqual([
    { day_key: 1707523200000, count: 1, attention_count: 1 },
    { day_key: 1707609600000, count: 1, attention_count: 0 },
  ]);
  expect(result.matches.map((m) => m.id)).toEqual(['m2', 'm3']);
  expect(result.matches[0]).toMatchObject({
    score_team1: 1,
    score_team2: 0,
    technical_winner: null,
  });
  const accepted = result.matches.find((m) => m.id === 'm3');
  expect(accepted?.agreement_accepted).toBe(true);
  expect(accepted?.agreement_pending).toBe(false);
  expect(accepted?.technical_winner).toBe('home');
});

test('listNextGameDays supports backward direction and keeps chronological order', async () => {
  matchFindAllMock
    .mockResolvedValueOnce([
      makeLightMatch('p1', '2024-02-06T12:00:00Z'),
      makeLightMatch('p2', '2024-02-08T13:00:00Z'),
      makeLightMatch('p3', '2024-02-09T09:30:00Z'),
      makeLightMatch('p4', '2024-02-10T15:45:00Z'),
      makeLightMatch('p5', '2024-02-12T08:00:00Z'),
    ])
    .mockResolvedValueOnce([
      makeMatch('p2', '2024-02-08T13:00:00Z'),
      makeMatch('p3', '2024-02-09T09:30:00Z'),
      makeMatch('p4', '2024-02-10T15:45:00Z'),
    ]);
  agreementFindAllMock.mockResolvedValue([
    { match_id: 'p4', MatchAgreementStatus: { alias: 'PENDING' } },
  ]);

  const result = await listNextGameDays({
    count: 3,
    horizonDays: 14,
    anchorDate: '2024-02-10',
    direction: 'backward',
  });

  expect(matchFindAllMock).toHaveBeenCalledTimes(2);
  expectValidRangeCall(0);
  expect(result.game_days).toEqual([
    '2024-02-08T00:00:00.000Z',
    '2024-02-09T00:00:00.000Z',
    '2024-02-10T00:00:00.000Z',
  ]);
  expect(result.matches.map((m) => m.id)).toEqual(['p2', 'p3', 'p4']);
  const pending = result.matches.find((m) => m.id === 'p4');
  expect(pending?.agreement_pending).toBe(true);
  expect(pending?.agreement_accepted).toBe(false);
});

test('listNextGameDays applies case-insensitive search via ILIKE', async () => {
  matchFindAllMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  agreementFindAllMock.mockResolvedValue([]);

  await listNextGameDays({
    q: 'Спартак',
    count: 2,
    horizonDays: 10,
  });

  const findOptions = matchFindAllMock.mock.calls[0][0];
  expect(findOptions.where[Op.and]).toBeDefined();
  const searchClause = findOptions.where[Op.and].find(
    (clause) => clause[Op.or]
  );
  expect(searchClause).toBeDefined();
  expect(searchClause[Op.or][0]).toEqual({
    '$HomeTeam.name$': { [Op.iLike]: '%Спартак%' },
  });
});

test('listNextGameDays does not apply heavy search clause for 1-char queries', async () => {
  matchFindAllMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  agreementFindAllMock.mockResolvedValue([]);

  await listNextGameDays({
    q: 'A',
    count: 2,
    horizonDays: 10,
  });

  const findOptions = matchFindAllMock.mock.calls[0][0];
  const ands = findOptions.where?.[Op.and] || [];
  const searchClause = ands.find((clause) => clause[Op.or]);
  expect(searchClause).toBeUndefined();
});

test('listNextGameDays merges multi-value filters for clubs/tournaments/groups/stadiums', async () => {
  matchFindAllMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  agreementFindAllMock.mockResolvedValue([]);

  await listNextGameDays({
    homeClubs: ['Клуб А'],
    awayClub: 'Клуб Б',
    tournaments: ['Кубок'],
    groupName: 'Группа X',
    stadiums: ['Арена 1'],
  });

  const ands = matchFindAllMock.mock.calls[0][0].where[Op.and];
  expect(ands).toEqual(
    expect.arrayContaining([
      { '$HomeTeam.Club.name$': { [Op.in]: ['Клуб А'] } },
      { '$AwayTeam.Club.name$': { [Op.in]: ['Клуб Б'] } },
      { '$Tournament.name$': { [Op.in]: ['Кубок'] } },
      { '$TournamentGroup.name$': { [Op.in]: ['Группа X'] } },
      { '$Ground.name$': { [Op.in]: ['Арена 1'] } },
    ])
  );
});

test('listNextGameDays handles Moscow midnight boundary correctly', async () => {
  matchFindAllMock
    .mockResolvedValueOnce([
      makeLightMatch('z1', '2024-02-09T20:59:59Z'), // 23:59:59 MSK on Feb 9
      makeLightMatch('z2', '2024-02-09T21:00:00Z'), // 00:00:00 MSK on Feb 10
    ])
    .mockResolvedValueOnce([makeMatch('z2', '2024-02-09T21:00:00Z')]);
  agreementFindAllMock.mockResolvedValue([]);

  const result = await listNextGameDays({
    count: 1,
    horizonDays: 3,
    anchorDate: '2024-02-10',
    direction: 'forward',
  });

  expect(result.game_days).toEqual(['2024-02-10T00:00:00.000Z']);
  expect(result.matches.map((m) => m.id)).toEqual(['z2']);
  expect(result.day_tabs).toEqual([
    { day_key: 1707523200000, count: 1, attention_count: 1 },
  ]);
});

test('listNextGameDays returns sparse set without over-fetch loops', async () => {
  matchFindAllMock
    .mockResolvedValueOnce([
      makeLightMatch('s1', '2024-02-06T11:00:00Z'),
      makeLightMatch('s2', '2024-02-08T11:00:00Z'),
    ])
    .mockResolvedValueOnce([
      makeMatch('s1', '2024-02-06T11:00:00Z'),
      makeMatch('s2', '2024-02-08T11:00:00Z'),
    ]);
  agreementFindAllMock.mockResolvedValue([]);

  const result = await listNextGameDays({
    count: 5,
    horizonDays: 10,
    anchorDate: '2024-02-20',
    direction: 'forward',
  });

  expect(matchFindAllMock).toHaveBeenCalledTimes(2);
  expect(result.matches.map((m) => m.id)).toEqual(['s1', 's2']);
  expect(result.game_days).toEqual([
    '2024-02-06T00:00:00.000Z',
    '2024-02-08T00:00:00.000Z',
  ]);
});
