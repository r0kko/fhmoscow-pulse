import { beforeEach, expect, jest, test } from '@jest/globals';

// Mocks
const maFindByPk = jest.fn();
const maCreate = jest.fn();
const maCount = jest.fn();
const matFindOne = jest.fn();
const masFindOne = jest.fn();
const matchFindByPk = jest.fn();
const teamFindByPk = jest.fn();
const groundFindAll = jest.fn();
const groundFindByPk = jest.fn();
const userFindByPk = jest.fn();

const tx = { LOCK: { UPDATE: 'UPDATE' } };
const transactionMock = jest.fn(async (cb) => cb(tx));

const syncApprovedMock = jest.fn();

// Provide consistent mock module shapes
jest.unstable_mockModule('../src/models/index.js', () => {
  const MatchAgreement = { findByPk: maFindByPk, create: maCreate, count: maCount };
  const MatchAgreementType = { findOne: matFindOne };
  const MatchAgreementStatus = { findOne: masFindOne };
  const Match = { findByPk: matchFindByPk };
  const User = { findByPk: userFindByPk };
  const Team = { findByPk: teamFindByPk };
  const Ground = { findAll: groundFindAll, findByPk: groundFindByPk };
  const GroundTeam = {};
  const Club = {};
  return {
    __esModule: true,
    MatchAgreement,
    MatchAgreementType,
    MatchAgreementStatus,
    Match,
    User,
    Team,
    Ground,
    GroundTeam,
    Club,
  };
});

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: transactionMock },
}));

jest.unstable_mockModule('../src/services/externalMatchSyncService.js', () => ({
  __esModule: true,
  default: { syncApprovedMatchToExternal: syncApprovedMock },
}));

const { default: service, listAvailableGrounds } = await import('../src/services/matchAgreementService.js');
const models = await import('../src/models/index.js');

beforeEach(() => {
  maFindByPk.mockReset();
  maCreate.mockReset();
  maCount.mockReset();
  matFindOne.mockReset();
  masFindOne.mockReset();
  matchFindByPk.mockReset();
  userFindByPk.mockReset();
  transactionMock.mockClear();
  syncApprovedMock.mockReset();
  teamFindByPk.mockReset();
  groundFindAll.mockReset();
});

test('approve locks only MatchAgreement (avoids outer join FOR UPDATE)', async () => {
  // Setup reference/status/type lookups
  masFindOne.mockImplementation(({ where: { alias } }) => ({ id: alias }));
  matFindOne.mockImplementation(({ where: { alias } }) => ({ id: alias }));
  maCount.mockResolvedValue(0); // anyAcceptedExists -> false

  // User is AWAY side for a HOME_PROPOSAL
  userFindByPk.mockResolvedValue({ id: 'u2', Teams: [{ id: 't2' }] });

  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const match = {
    id: 'm1',
    team1_id: 't1',
    team2_id: 't2',
    date_start: future,
    update: jest.fn(),
  };

  // First fetch (pre-validate)
  const preAgreement = {
    id: 'a1',
    match_id: 'm1',
    ground_id: 'g1',
    date_start: future,
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
    MatchAgreementStatus: { alias: 'PENDING' },
    Match: match,
  };

  // Second fetch (inside transaction) should carry restricted lock
  const freshAgreement = {
    id: 'a1',
    MatchAgreementStatus: { alias: 'PENDING' },
    update: jest.fn(),
  };

  let capturedOptions;
  maFindByPk
    .mockResolvedValueOnce(preAgreement)
    .mockImplementationOnce((id, opts) => {
      capturedOptions = opts;
      return Promise.resolve(freshAgreement);
    });

  syncApprovedMock.mockResolvedValue();
  maCreate.mockResolvedValue({ id: 'a2' });

  const result = await service.approve('a1', 'u2');
  expect(result).toEqual({ ok: true });

  // Ensure transaction used
  expect(transactionMock).toHaveBeenCalled();
  // Ensure lock is restricted to base model (not all joined tables)
  expect(capturedOptions).toBeTruthy();
  expect(capturedOptions.transaction).toBe(tx);
  expect(capturedOptions.lock).toEqual({ level: tx.LOCK.UPDATE, of: models.MatchAgreement });
});

test('withdraw marks HOME proposal as WITHDRAWN by author side', async () => {
  // status lookups
  masFindOne.mockImplementation(({ where: { alias } }) => ({ id: alias }));

  // user is HOME side for HOME_PROPOSAL
  userFindByPk.mockResolvedValue({ id: 'u1', Teams: [{ id: 't1' }] });

  const match = {
    id: 'm1',
    team1_id: 't1',
    team2_id: 't2',
  };
  const updateMock = jest.fn();
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  maFindByPk.mockResolvedValue({
    id: 'a1',
    Match: match,
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
    MatchAgreementStatus: { alias: 'PENDING' },
    date_start: future,
    update: updateMock,
  });

  const { withdraw } = await import('../src/services/matchAgreementService.js');
  const res = await withdraw('a1', 'u1');
  expect(res).toEqual({ ok: true });
  expect(updateMock).toHaveBeenCalledWith(
    { status_id: 'WITHDRAWN', updated_by: 'u1' },
    { transaction: tx }
  );
});

test('withdraw falls back to SUPERSEDED when WITHDRAWN status missing', async () => {
  masFindOne.mockImplementation(({ where: { alias } }) => {
    if (alias === 'WITHDRAWN') return null; // trigger fallback
    return { id: alias };
  });
  userFindByPk.mockResolvedValue({ id: 'u1', Teams: [{ id: 't1' }] });
  const match = { id: 'm1', team1_id: 't1', team2_id: 't2' };
  const updateMock = jest.fn();
  maFindByPk.mockResolvedValue({
    id: 'a1',
    Match: match,
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
    MatchAgreementStatus: { alias: 'PENDING' },
    update: updateMock,
  });
  const { withdraw } = await import('../src/services/matchAgreementService.js');
  const res = await withdraw('a1', 'u1');
  expect(res).toEqual({ ok: true });
  expect(updateMock).toHaveBeenCalledWith(
    { status_id: 'SUPERSEDED', updated_by: 'u1' },
    { transaction: tx }
  );
});

test('decline sets status to DECLINED and records event', async () => {
  masFindOne.mockImplementation(({ where: { alias } }) => ({ id: alias }));
  matFindOne.mockImplementation(({ where: { alias } }) => ({ id: alias }));
  const createdMock = maCreate.mockResolvedValue({ id: 'a3' });

  // User is AWAY side, agreement is HOME_PROPOSAL
  userFindByPk.mockResolvedValue({ id: 'u2', Teams: [{ id: 't2' }] });
  const updateMock = jest.fn();
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  maFindByPk.mockResolvedValue({
    id: 'a1',
    Match: { id: 'm1', team1_id: 't1', team2_id: 't2' },
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
    MatchAgreementStatus: { alias: 'PENDING' },
    ground_id: 'g1',
    date_start: future,
    update: updateMock,
  });

  const { default: svc } = await import('../src/services/matchAgreementService.js');
  const res = await svc.decline('a1', 'u2');
  expect(res).toEqual({ ok: true });
  expect(updateMock).toHaveBeenCalledWith(
    { status_id: 'DECLINED', updated_by: 'u2' },
    { transaction: tx }
  );
  expect(createdMock).toBeDefined();
});

test('approve rejects unsupported agreement type', async () => {
  // No need for external sync; error thrown earlier
  userFindByPk.mockResolvedValue({ id: 'u1', Teams: [{ id: 't1' }] });
  maFindByPk.mockResolvedValue({
    id: 'a1',
    match_id: 'm1',
    Match: { id: 'm1', team1_id: 't1', team2_id: 't2' },
    MatchAgreementType: { alias: 'HOME_APPROVAL' }, // unsupported for approve()
    MatchAgreementStatus: { alias: 'PENDING' },
  });
  await expect(service.approve('a1', 'u1')).rejects.toBeTruthy();
});

test('approve rejects when away tries to approve AWAY_COUNTER', async () => {
  // User is AWAY, but AWAY_COUNTER requires HOME to approve
  userFindByPk.mockResolvedValue({ id: 'u2', Teams: [{ id: 't2' }] });
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  maFindByPk.mockResolvedValue({
    id: 'a1',
    match_id: 'm1',
    date_start: future,
    Match: { id: 'm1', team1_id: 't1', team2_id: 't2', date_start: future },
    MatchAgreementType: { alias: 'AWAY_COUNTER' },
    MatchAgreementStatus: { alias: 'PENDING' },
  });
  await expect(service.approve('a1', 'u2')).rejects.toBeTruthy();
});

test('listAvailableGrounds rejects when match not found', async () => {
  matchFindByPk.mockResolvedValue(null);
  await expect(
    listAvailableGrounds('m-not-exist', 'u1')
  ).rejects.toBeTruthy();
});

test('listAvailableGrounds rejects when home team not set', async () => {
  matchFindByPk.mockResolvedValue({ id: 'm1', team1_id: null });
  userFindByPk.mockResolvedValue({ id: 'u1', Teams: [] });
  await expect(listAvailableGrounds('m1', 'u1')).rejects.toBeTruthy();
});

test('listAvailableGrounds returns club and grounds list', async () => {
  matchFindByPk.mockResolvedValue({ id: 'm1', team1_id: 't1' });
  userFindByPk.mockResolvedValue({ id: 'u1', Teams: [{ id: 't1' }] });
  teamFindByPk.mockResolvedValue({ id: 't1', Club: { id: 'c1', name: 'Club' } });
  groundFindAll.mockResolvedValue([{ id: 'g1', name: 'G1' }]);
  const res = await listAvailableGrounds('m1', 'u1');
  expect(res.club).toEqual({ id: 'c1', name: 'Club' });
  expect(res.grounds).toEqual([{ id: 'g1', name: 'G1' }]);
});

test('listAvailableGrounds returns empty grounds for past match', async () => {
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  matchFindByPk.mockResolvedValue({ id: 'm1', team1_id: 't1', date_start: past });
  userFindByPk.mockResolvedValue({ id: 'u1', Teams: [{ id: 't1' }] });
  teamFindByPk.mockResolvedValue({ id: 't1', Club: { id: 'c1', name: 'Club' } });
  const res = await listAvailableGrounds('m1', 'u1');
  expect(res.grounds).toEqual([]);
});

test('approve rejects when agreement is not PENDING', async () => {
  userFindByPk.mockResolvedValue({ id: 'u1', Teams: [{ id: 't1' }] });
  maFindByPk.mockResolvedValue({
    id: 'a1',
    match_id: 'm1',
    Match: { id: 'm1', team1_id: 't1', team2_id: 't2' },
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
    MatchAgreementStatus: { alias: 'DECLINED' }, // not pending
  });
  await expect(service.approve('a1', 'u1')).rejects.toBeTruthy();
});

test('withdraw rejects when non-author side attempts', async () => {
  userFindByPk.mockResolvedValue({ id: 'u2', Teams: [{ id: 't2' }] });
  maFindByPk.mockResolvedValue({
    id: 'a1',
    Match: { id: 'm1', team1_id: 't1', team2_id: 't2' },
    MatchAgreementType: { alias: 'HOME_PROPOSAL' },
    MatchAgreementStatus: { alias: 'PENDING' },
    update: jest.fn(),
  });
  const { withdraw } = await import('../src/services/matchAgreementService.js');
  await expect(withdraw('a1', 'u2')).rejects.toBeTruthy();
});

test('decline rejects when away tries to decline AWAY_COUNTER', async () => {
  userFindByPk.mockResolvedValue({ id: 'u2', Teams: [{ id: 't2' }] });
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  maFindByPk.mockResolvedValue({
    id: 'a1',
    Match: { id: 'm1', team1_id: 't1', team2_id: 't2', date_start: future },
    MatchAgreementType: { alias: 'AWAY_COUNTER' },
    MatchAgreementStatus: { alias: 'PENDING' },
    date_start: future,
    update: jest.fn(),
  });
  const { default: svc } = await import('../src/services/matchAgreementService.js');
  await expect(svc.decline('a1', 'u2')).rejects.toBeTruthy();
});

test('create rejects when match not found', async () => {
  matchFindByPk.mockResolvedValue(null);
  await expect(
    service.create('missing', { date_start: '2025-01-01T10:00:00Z', ground_id: 'g1' }, 'u1')
  ).rejects.toBeTruthy();
});

test('create rejects when match date not set', async () => {
  matchFindByPk.mockResolvedValue({ id: 'm1', date_start: null });
  await expect(
    service.create('m1', { date_start: '2025-01-01T10:00:00Z', ground_id: 'g1' }, 'u1')
  ).rejects.toBeTruthy();
});

test('create rejects invalid kickoff time', async () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  matchFindByPk.mockResolvedValue({ id: 'm1', date_start: future, team1_id: 't1' });
  // make user HOME side so validation reaches kickoff parsing
  userFindByPk.mockResolvedValue({ id: 'u1', Teams: [{ id: 't1' }] });
  await expect(
    service.create('m1', { date_start: 'not-a-date', ground_id: 'g1' }, 'u1')
  ).rejects.toBeTruthy();
});

test('create rejects kickoff date mismatch with match date', async () => {
  const matchDate = new Date('2025-03-10T00:00:00Z').toISOString();
  const other = new Date('2025-03-11T00:00:00Z').toISOString();
  matchFindByPk.mockResolvedValue({ id: 'm1', date_start: matchDate, team1_id: 't1' });
  userFindByPk.mockResolvedValue({ id: 'u1', Teams: [{ id: 't1' }] });
  await expect(
    service.create('m1', { date_start: other, ground_id: 'g1' }, 'u1')
  ).rejects.toBeTruthy();
});
