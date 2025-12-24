import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const userFindByPkMock = jest.fn();
const matchFindAllMock = jest.fn();
const matchCountMock = jest.fn();
const agreementFindAllMock = jest.fn();

// Provide models used by listUpcomingLocal/listPastLocal
jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findByPk: userFindByPkMock },
  Team: {},
  Ground: {},
  Tournament: {},
  TournamentGroup: {},
  Tour: {},
  GameStatus: {},
  Match: { findAll: matchFindAllMock, count: matchCountMock },
  MatchAgreement: { findAll: agreementFindAllMock },
  MatchAgreementStatus: {},
}));

const { listUpcomingLocal, listPastLocal } =
  await import('../src/services/matchService.js');

beforeEach(() => {
  userFindByPkMock.mockReset();
  matchFindAllMock.mockReset();
  matchCountMock.mockReset();
  agreementFindAllMock.mockReset();
});

function makeMatch({ id = 'm1', when = 'future', home = true } = {}) {
  const now = Date.now();
  const delta = when === 'past' ? -24 * 3600 * 1000 : 2 * 3600 * 1000;
  const date = new Date(now + delta);
  return {
    id,
    date_start: date,
    team1_id: home ? 't1' : 'tX',
    team2_id: home ? 'tX' : 't1',
    Ground: { name: 'Stadium' },
    HomeTeam: { name: 'Team 1' },
    AwayTeam: { name: 'Team X' },
    GameStatus: { name: 'Запланирован', alias: 'SCHEDULED' },
    Tournament: { name: 'Турнир' },
    TournamentGroup: { name: 'A' },
    Tour: { name: '3' },
    scheduled_date: null,
  };
}

test('listUpcomingLocal maps rows and computes urgent flag when not accepted', async () => {
  userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't1' }] });
  const m = makeMatch({ when: 'future', home: true });
  matchFindAllMock.mockResolvedValue([m]);
  matchCountMock.mockResolvedValue(1);
  // Only pending agreements present
  agreementFindAllMock.mockResolvedValue([
    { match_id: m.id, MatchAgreementStatus: { alias: 'PENDING' } },
  ]);
  const { rows, count } = await listUpcomingLocal('u1', {
    limit: 10,
    offset: 0,
    q: 'Team',
    type: 'all',
  });
  expect(count).toBe(1);
  expect(rows[0]).toMatchObject({
    id: m.id,
    stadium: 'Stadium',
    team1: 'Team 1',
    team2: 'Team X',
    is_home: true,
    agreement_accepted: false,
    agreement_pending: true,
    urgent_unagreed: true,
  });
  // Ensure search filters applied in query object
  const args = matchFindAllMock.mock.calls[0][0];
  expect(args.where[Op.and]).toBeDefined();
});

test('listPastLocal returns past matches with season filter', async () => {
  userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't1' }] });
  const m = makeMatch({ when: 'past', home: false });
  m.season_id = 2025;
  matchFindAllMock.mockResolvedValue([m]);
  matchCountMock.mockResolvedValue(1);
  const { rows } = await listPastLocal('u1', {
    seasonId: 2025,
    limit: 5,
    offset: 5,
    q: 'Турнир',
    type: 'away',
  });
  expect(rows[0]).toMatchObject({
    id: m.id,
    stadium: 'Stadium',
    team1: 'Team 1',
    team2: 'Team X',
    is_home: false,
    season_id: 2025,
  });
  const args = matchFindAllMock.mock.calls[0][0];
  expect(args.limit).toBe(5);
  expect(args.offset).toBe(5);
  expect(args.where.season_id).toBe(2025);
});

test('listPastLocal orders by date_start DESC', async () => {
  userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't1' }] });
  matchFindAllMock.mockResolvedValue([]);
  await listPastLocal('u1', { limit: 10, offset: 0 });
  const args = matchFindAllMock.mock.calls[0][0];
  expect(Array.isArray(args.order)).toBe(true);
  expect(args.order[0]).toEqual(['date_start', 'DESC']);
});
