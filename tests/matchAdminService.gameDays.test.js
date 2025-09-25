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
  TournamentGroup: {},
  Tour: {},
  MatchAgreement: { findAll: agreementFindAllMock },
  MatchAgreementStatus: {},
  MatchAgreementType: {},
  GameStatus: {},
}));

const { listNextGameDays } = await import(
  '../src/services/matchAdminService.js'
);

function makeMatch(id, isoDate, overrides = {}) {
  return {
    id,
    date_start: new Date(isoDate),
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

function expectValidRangeCall() {
  const args = matchFindAllMock.mock.calls[0]?.[0];
  expect(args).toBeDefined();
  expect(args.where?.date_start?.[Op.gte]).toBeInstanceOf(Date);
  expect(args.where?.date_start?.[Op.lt]).toBeInstanceOf(Date);
  expect(
    args.where.date_start[Op.lt].getTime() >
      args.where.date_start[Op.gte].getTime()
  ).toBe(true);
}

test('listNextGameDays supports forward direction with custom anchor', async () => {
  matchFindAllMock.mockResolvedValue([
    makeMatch('m1', '2024-02-09T09:00:00Z'),
    makeMatch('m2', '2024-02-10T10:15:00Z'),
    makeMatch('m3', '2024-02-11T11:30:00Z'),
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

  expect(matchFindAllMock).toHaveBeenCalledTimes(1);
  expectValidRangeCall();
  expect(result.game_days).toEqual([
    '2024-02-10T00:00:00.000Z',
    '2024-02-11T00:00:00.000Z',
  ]);
  expect(result.matches.map((m) => m.id)).toEqual(['m2', 'm3']);
  const accepted = result.matches.find((m) => m.id === 'm3');
  expect(accepted?.agreement_accepted).toBe(true);
  expect(accepted?.agreement_pending).toBe(false);
});

test('listNextGameDays supports backward direction and keeps chronological order', async () => {
  matchFindAllMock.mockResolvedValue([
    makeMatch('p1', '2024-02-06T12:00:00Z'),
    makeMatch('p2', '2024-02-08T13:00:00Z'),
    makeMatch('p3', '2024-02-09T09:30:00Z'),
    makeMatch('p4', '2024-02-10T15:45:00Z'),
    makeMatch('p5', '2024-02-12T08:00:00Z'),
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

  expect(matchFindAllMock).toHaveBeenCalledTimes(1);
  expectValidRangeCall();
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
