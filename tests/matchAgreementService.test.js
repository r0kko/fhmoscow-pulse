import { beforeEach, expect, jest, test } from '@jest/globals';

const matchFindByPkMock = jest.fn();
const userFindByPkMock = jest.fn();
const groundFindByPkMock = jest.fn();
const groundTeamFindOneMock = jest.fn();
const maStatusFindOneMock = jest.fn();
const maTypeFindOneMock = jest.fn();
const maCountMock = jest.fn();
const maCreateMock = jest.fn();
const maFindByPkMock = jest.fn();
const matchUpdateMock = jest.fn();

const sendProposedMock = jest.fn();
const sendApprovedMock = jest.fn();
const sendDeclinedMock = jest.fn();
const sendWithdrawnMock = jest.fn();

const listTeamUsersMock = jest.fn();

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
  matchUpdateMock.mockReset();

  sendProposedMock.mockReset();
  sendApprovedMock.mockReset();
  listTeamUsersMock.mockReset();
});

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: {
    transaction: async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } }),
  },
}));

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
  Team: {},
  Club: {},
  Tournament: {},
  TournamentGroup: {},
  Tour: {},
  GameStatus: {},
}));

jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  listTeamUsers: listTeamUsersMock,
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendMatchAgreementProposedEmail: sendProposedMock,
    sendMatchAgreementApprovedEmail: sendApprovedMock,
    sendMatchAgreementDeclinedEmail: sendDeclinedMock,
    sendMatchAgreementWithdrawnEmail: sendWithdrawnMock,
  },
}));

jest.unstable_mockModule('../src/services/externalMatchSyncService.js', () => ({
  __esModule: true,
  default: { syncApprovedMatchToExternal: jest.fn().mockResolvedValue(true) },
}));

const { default: service } = await import(
  '../src/services/matchAgreementService.js'
);

test('create (HOME_PROPOSAL) notifies away team staff', async () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  // Match with team1 (home) and team2 (away)
  matchFindByPkMock.mockResolvedValue({
    id: 'm1',
    date_start: future,
    team1_id: 't1',
    team2_id: 't2',
    HomeTeam: { name: 'Home' },
    AwayTeam: { name: 'Away' },
    Ground: { name: '' },
    Tournament: { name: 'Cup' },
    TournamentGroup: { name: 'A' },
    Tour: { name: '1' },
  });
  userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't1' }] });
  groundFindByPkMock.mockResolvedValue({ id: 'g1', name: 'Stadium' });
  groundTeamFindOneMock.mockResolvedValue({});
  maStatusFindOneMock.mockImplementation(({ where }) => {
    if (where.alias === 'PENDING') return Promise.resolve({ id: 'st_pen' });
    if (where.alias === 'ACCEPTED') return Promise.resolve({ id: 'st_acc' });
    if (where.alias === 'WITHDRAWN') return Promise.resolve({ id: 'st_wd' });
    return Promise.resolve({ id: 'st_other' });
  });
  maTypeFindOneMock.mockImplementation(({ where }) => {
    if (where.alias === 'HOME_PROPOSAL')
      return Promise.resolve({ id: 'tp_home' });
    return Promise.resolve({ id: 'tp_other' });
  });
  maCountMock.mockResolvedValue(0);
  maCreateMock.mockResolvedValue({
    id: 'agr1',
    match_id: 'm1',
    ground_id: 'g1',
    date_start: future,
    parent_id: null,
  });
  listTeamUsersMock.mockResolvedValue([{ id: 'u2', email: 'away@x' }]);

  await service.create(
    'm1',
    { ground_id: 'g1', date_start: future },
    'user_home'
  );

  expect(sendProposedMock).toHaveBeenCalled();
  expect(listTeamUsersMock).toHaveBeenCalledWith('t2');
});

test('approve notifies both sides', async () => {
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  // First fetch of agreement (pre-validate)
  maFindByPkMock.mockResolvedValueOnce({
    id: 'agr1',
    match_id: 'm1',
    ground_id: 'g1',
    date_start: future,
    Match: {
      id: 'm1',
      date_start: future,
      team1_id: 't1',
      team2_id: 't2',
      update: matchUpdateMock,
    },
    MatchAgreementStatus: { alias: 'PENDING' },
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
  });
  matchFindByPkMock.mockResolvedValueOnce({
    id: 'm1',
    date_start: future,
    team1_id: 't1',
    team2_id: 't2',
  });
  // actor is away
  userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't2' }] });
  maStatusFindOneMock.mockImplementation(({ where }) => {
    if (where.alias === 'ACCEPTED') return Promise.resolve({ id: 'st_acc' });
    if (where.alias === 'PENDING') return Promise.resolve({ id: 'st_pen' });
    return Promise.resolve({ id: 'st_other' });
  });
  maCountMock.mockResolvedValue(0);
  // fresh inside transaction
  maFindByPkMock.mockResolvedValueOnce({
    id: 'agr1',
    MatchAgreementStatus: { alias: 'PENDING' },
    update: jest.fn().mockResolvedValue({}),
  });
  maTypeFindOneMock.mockResolvedValue({ id: 'tp_approve' });
  // update/create within tx
  maCreateMock.mockResolvedValue({ id: 'agr2' });
  matchUpdateMock.mockResolvedValue(true);
  // After commit, enrich match
  matchFindByPkMock.mockResolvedValueOnce({
    id: 'm1',
    date_start: future,
    team1_id: 't1',
    team2_id: 't2',
    HomeTeam: { name: 'Home' },
    AwayTeam: { name: 'Away' },
    Ground: { name: 'Stadium' },
    Tournament: { name: 'Cup' },
    TournamentGroup: { name: 'A' },
    Tour: { name: '1' },
  });
  groundFindByPkMock.mockResolvedValue({ id: 'g1', name: 'Stadium' });
  listTeamUsersMock
    .mockResolvedValueOnce([{ id: 'u1', email: 'home@x' }])
    .mockResolvedValueOnce([{ id: 'u2', email: 'away@x' }]);

  await service.approve('agr1', 'user_away');

  expect(sendApprovedMock).toHaveBeenCalled();
  // Should notify both home and away
  expect(listTeamUsersMock).toHaveBeenNthCalledWith(1, 't1');
  expect(listTeamUsersMock).toHaveBeenNthCalledWith(2, 't2');
});

test('decline notifies both teams', async () => {
  const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  // First call inside tx
  maFindByPkMock.mockResolvedValueOnce({
    id: 'agrD',
    match_id: 'mD',
    ground_id: 'g1',
    date_start: future,
    Match: { id: 'mD', date_start: future, team1_id: 't1', team2_id: 't2' },
    MatchAgreementStatus: { alias: 'PENDING' },
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
    update: jest.fn().mockResolvedValue({}),
  });
  matchFindByPkMock.mockResolvedValue({ id: 'mD', date_start: future });
  userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't2' }] }); // actor away
  maStatusFindOneMock.mockResolvedValue({ id: 'stD' });
  maTypeFindOneMock.mockResolvedValue({ id: 'tpD' });
  maCreateMock.mockResolvedValue({});
  // Post-commit reads
  maFindByPkMock.mockResolvedValueOnce({
    id: 'agrD',
    match_id: 'mD',
    ground_id: 'g1',
    date_start: future,
    Match: { id: 'mD' },
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
  });
  matchFindByPkMock.mockResolvedValueOnce({
    id: 'mD',
    date_start: future,
    team1_id: 't1',
    team2_id: 't2',
    HomeTeam: { name: 'Home' },
    AwayTeam: { name: 'Away' },
    Ground: { name: 'Stadium' },
    Tournament: { name: 'Cup' },
    TournamentGroup: { name: 'A' },
    Tour: { name: '1' },
  });
  groundFindByPkMock.mockResolvedValue({ id: 'g1', name: 'Stadium' });
  listTeamUsersMock
    .mockResolvedValueOnce([{ email: 'home@x' }])
    .mockResolvedValueOnce([{ email: 'away@x' }]);

  await service.decline('agrD', 'user_away');
  expect(sendDeclinedMock).toHaveBeenCalled();
});

test('withdraw notifies opponent', async () => {
  const future = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
  maFindByPkMock.mockResolvedValueOnce({
    id: 'agrW',
    match_id: 'mW',
    ground_id: 'g1',
    date_start: future,
    Match: { id: 'mW', team1_id: 't1', team2_id: 't2' },
    MatchAgreementStatus: { alias: 'PENDING' },
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
    update: jest.fn().mockResolvedValue({}),
  });
  userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't1' }] }); // actor home
  maStatusFindOneMock.mockResolvedValue({ id: 'stW' });
  // Post-commit reads
  maFindByPkMock.mockResolvedValueOnce({
    id: 'agrW',
    match_id: 'mW',
    ground_id: 'g1',
    date_start: future,
    Match: { id: 'mW' },
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
  });
  matchFindByPkMock.mockResolvedValueOnce({
    id: 'mW',
    date_start: future,
    team1_id: 't1',
    team2_id: 't2',
    HomeTeam: { name: 'Home' },
    AwayTeam: { name: 'Away' },
  });
  groundFindByPkMock.mockResolvedValue({ id: 'g1', name: 'Stadium' });
  listTeamUsersMock.mockResolvedValueOnce([{ email: 'away@x' }]);

  await service.withdraw('agrW', 'user_home');
  expect(sendWithdrawnMock).toHaveBeenCalled();
});

test('create throws when match is cancelled', async () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  matchFindByPkMock.mockResolvedValue({
    id: 'mC',
    date_start: future,
    team1_id: 't1',
    team2_id: 't2',
    GameStatus: { alias: 'CANCELLED' },
  });
  await expect(
    service.create('mC', { ground_id: 'g1', date_start: future }, 'actor')
  ).rejects.toMatchObject({ code: 'match_cancelled', status: 409 });
});

test('approve throws when match is cancelled', async () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  // First fetch of agreement
  maFindByPkMock.mockResolvedValueOnce({
    id: 'agrC',
    match_id: 'mC',
    ground_id: 'g1',
    date_start: future,
    Match: {
      id: 'mC',
      date_start: future,
      team1_id: 't1',
      team2_id: 't2',
      GameStatus: { alias: 'CANCELLED' },
    },
    MatchAgreementStatus: { alias: 'PENDING' },
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
  });
  userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't2' }] });
  await expect(service.approve('agrC', 'user_away')).rejects.toMatchObject({
    code: 'match_cancelled',
    status: 409,
  });
});

test('approve reloads match to resolve side when Match include lacks team ids', async () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  // Agreement prefetch returns Match without team fields (regression scenario)
  maFindByPkMock.mockResolvedValueOnce({
    id: 'agrR',
    match_id: 'mR',
    ground_id: 'g1',
    date_start: future,
    Match: { id: 'mR', date_start: future },
    MatchAgreementStatus: { alias: 'PENDING' },
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
  });
  // ensureMatchWithStatus fetch
  matchFindByPkMock.mockResolvedValueOnce({
    id: 'mR',
    date_start: future,
    team1_id: 't1',
    team2_id: 't2',
    GameStatus: { alias: 'SCHEDULED' },
  });
  // actor is away
  userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't2' }] });
  maStatusFindOneMock.mockImplementation(({ where }) => {
    if (where.alias === 'ACCEPTED') return Promise.resolve({ id: 'st_acc' });
    if (where.alias === 'PENDING') return Promise.resolve({ id: 'st_pen' });
    return Promise.resolve({ id: 'st_other' });
  });
  maCountMock.mockResolvedValue(0);
  // fresh inside tx
  maFindByPkMock.mockResolvedValueOnce({
    id: 'agrR',
    MatchAgreementStatus: { alias: 'PENDING' },
    update: jest.fn().mockResolvedValue({}),
  });
  maTypeFindOneMock.mockResolvedValue({ id: 'tp_approve' });
  maCreateMock.mockResolvedValue({ id: 'agrR2' });
  matchUpdateMock.mockResolvedValue(true);
  // Post-commit enrich
  matchFindByPkMock.mockResolvedValueOnce({
    id: 'mR',
    date_start: future,
    team1_id: 't1',
    team2_id: 't2',
  });
  groundFindByPkMock.mockResolvedValue({ id: 'g1', name: 'Stadium' });
  listTeamUsersMock
    .mockResolvedValueOnce([{ email: 'home@x' }])
    .mockResolvedValueOnce([{ email: 'away@x' }]);

  await expect(service.approve('agrR', 'actor_away')).resolves.toEqual({
    ok: true,
  });
});

test('approve fails with match_teams_not_set when teams are missing', async () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  maFindByPkMock.mockResolvedValueOnce({
    id: 'agrZ',
    match_id: 'mZ',
    ground_id: 'g1',
    date_start: future,
    Match: { id: 'mZ', date_start: future },
    MatchAgreementStatus: { alias: 'PENDING' },
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
  });
  // ensureMatchWithStatus returns match without team ids as well
  matchFindByPkMock.mockResolvedValueOnce({
    id: 'mZ',
    date_start: future,
    GameStatus: { alias: 'SCHEDULED' },
  });
  userFindByPkMock.mockResolvedValue({ Teams: [{ id: 't2' }] });

  await expect(service.approve('agrZ', 'actor')).rejects.toMatchObject({
    code: 'match_teams_not_set',
    status: 409,
  });
});
