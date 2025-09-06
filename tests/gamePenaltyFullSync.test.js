import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const extFindAllMock = jest.fn();

const matchFindAllMock = jest.fn();
const typeFindOneMock = jest.fn();
const playerFindAllMock = jest.fn();
const violationFindAllMock = jest.fn();
const minutesFindAllMock = jest.fn();
const penaltyFindAllMock = jest.fn();
const penaltyCreateMock = jest.fn();
const penaltyUpdateMock = jest.fn();

beforeEach(() => {
  extFindAllMock.mockReset();
  matchFindAllMock.mockReset();
  typeFindOneMock.mockReset();
  playerFindAllMock.mockReset();
  violationFindAllMock.mockReset();
  minutesFindAllMock.mockReset();
  penaltyFindAllMock.mockReset();
  penaltyCreateMock.mockReset();
  penaltyUpdateMock.mockReset();
  penaltyUpdateMock.mockResolvedValue([0]);
});

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  GameEvent: { findAll: extFindAllMock },
  GameEventType: { findOne: jest.fn() },
}));

const txMock = {};
const transactionMock = jest.fn(async (cbOrOpts, maybeCb) => {
  const cb = typeof cbOrOpts === 'function' ? cbOrOpts : maybeCb;
  return cb(txMock);
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  GamePenalty: {
    findAll: penaltyFindAllMock,
    create: penaltyCreateMock,
    update: penaltyUpdateMock,
    sequelize: { transaction: transactionMock },
  },
  Match: { findAll: matchFindAllMock },
  GameEventType: { findOne: typeFindOneMock },
  Player: { findAll: playerFindAllMock },
  GameViolation: { findAll: violationFindAllMock },
  PenaltyMinutes: { findAll: minutesFindAllMock },
}));

const { syncExternal } = await import(
  '../src/services/gamePenaltySyncService.js'
);

test('syncExternal upserts and soft-deletes penalties across all matches', async () => {
  // Local matches known
  matchFindAllMock.mockResolvedValueOnce([
    { id: 'm100', external_id: 100 },
    { id: 'm101', external_id: 101 },
  ]);

  // Resolve penalty type id and local type mapping
  typeFindOneMock.mockImplementation(async (opts) => {
    if (opts?.where?.name) return { external_id: 9 };
    if (opts?.where?.external_id === 9)
      return { id: 'evtType1', external_id: 9 };
    return null;
  });

  // External penalty events for both matches
  extFindAllMock.mockResolvedValueOnce([
    {
      id: 2001,
      game_id: 100,
      penalty_player_id: 777,
      penalty_violation_id: 10,
      minute: 12,
      second: 34,
      period: 2,
      penalty_minutes_id: 2,
      team_penalty: false,
    },
    {
      id: 2002,
      game_id: 101,
      penalty_player_id: null,
      penalty_violation_id: null,
      minute: null,
      second: null,
      period: 3,
      penalty_minutes_id: null,
      team_penalty: true,
    },
  ]);

  // Cross-table mappings
  playerFindAllMock.mockResolvedValueOnce([{ id: 'p777', external_id: 777 }]);
  violationFindAllMock.mockResolvedValueOnce([
    { id: 'vio10', external_id: 10 },
  ]);
  minutesFindAllMock.mockResolvedValueOnce([{ id: 'pm2', external_id: 2 }]);

  // Existing local penalties: one exists matching 2001
  const local2001 = {
    external_id: 2001,
    game_id: 'm100',
    event_type_id: 'evtType1',
    penalty_player_id: 'p777',
    penalty_violation_id: 'vio10',
    minute: 10, // differs -> should update to 12
    second: 34,
    period: 2,
    penalty_minutes_id: 'pm2',
    team_penalty: false,
    update: jest.fn().mockResolvedValue(true),
    restore: jest.fn().mockResolvedValue(true),
  };
  penaltyFindAllMock.mockResolvedValueOnce([local2001]);

  // Soft delete counts: first match 0, second match 1 (simulate existing stray)
  penaltyUpdateMock.mockResolvedValueOnce([0]);
  penaltyUpdateMock.mockResolvedValueOnce([1]);

  penaltyCreateMock.mockResolvedValueOnce({ id: 'created2002' });

  const res = await syncExternal('admin');
  expect(res.upserts).toBeGreaterThan(0);
  expect(res.softDeleted).toBe(1);

  // Created for 2002
  expect(penaltyCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      external_id: 2002,
      game_id: 'm101',
      period: 3,
      team_penalty: true,
      created_by: 'admin',
      updated_by: 'admin',
    }),
    expect.objectContaining({ transaction: expect.any(Object) })
  );

  // Updated for 2001
  expect(local2001.update).toHaveBeenCalledWith(
    expect.objectContaining({ minute: 12, updated_by: 'admin' }),
    expect.objectContaining({ transaction: expect.any(Object) })
  );

  // Soft-delete called per match
  const calls = penaltyUpdateMock.mock.calls;
  expect(calls).toHaveLength(2);
  const forM100 = calls.find((c) => c?.[1]?.where?.game_id === 'm100');
  const forM101 = calls.find((c) => c?.[1]?.where?.game_id === 'm101');
  expect(forM100[1].where.external_id[Op.notIn]).toEqual([2001]);
  expect(forM101[1].where.external_id[Op.notIn]).toEqual([2002]);
});
