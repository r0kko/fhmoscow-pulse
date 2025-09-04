import { beforeEach, expect, jest, test, describe } from '@jest/globals';

const matchFindByPkMock = jest.fn();
const userFindByPkMock = jest.fn();
const groundFindByPkMock = jest.fn();
const groundTeamFindOneMock = jest.fn();
const maStatusFindOneMock = jest.fn();
const maTypeFindOneMock = jest.fn();
const maCountMock = jest.fn();
const maCreateMock = jest.fn();
const maFindByPkMock = jest.fn();

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: async (fn) => fn({}) },
}));

const teamFindByPkMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: matchFindByPkMock },
  User: { findByPk: userFindByPkMock },
  Ground: { findByPk: groundFindByPkMock },
  GroundTeam: { findOne: groundTeamFindOneMock },
  MatchAgreementStatus: { findOne: maStatusFindOneMock },
  MatchAgreementType: { findOne: maTypeFindOneMock },
  MatchAgreement: {
    count: maCountMock,
    create: maCreateMock,
    findByPk: maFindByPkMock,
  },
  Team: { findByPk: teamFindByPkMock },
  Club: {},
  Tournament: {},
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
  groundTeamFindOneMock.mockReset();
  maStatusFindOneMock.mockReset();
  maTypeFindOneMock.mockReset();
  maCountMock.mockReset();
  maCreateMock.mockReset();
  maFindByPkMock.mockReset();
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
    userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't2' }] }); // not home
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
    userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't1' }] }); // home, not away
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
    userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't2' }] }); // away now
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
    userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't1' }] }); // home
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
    userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't1' }] });
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
    userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't1' }] });
    const res2 = await listAvailableGrounds('m5', 'actor');
    expect(res2.grounds.length).toBe(0);
  });
});
