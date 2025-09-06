import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const extFindAllMock = jest.fn();
const matchFindByPkMock = jest.fn();
const typeFindOneMock = jest.fn();
const playerFindAllMock = jest.fn();
const violationFindAllMock = jest.fn();
const minutesFindAllMock = jest.fn();
const penaltyFindAllMock = jest.fn();
const penaltyCreateMock = jest.fn();
const penaltyUpdateMock = jest.fn();

beforeEach(() => {
  extFindAllMock.mockReset();
  matchFindByPkMock.mockReset();
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

const _restoreMock = jest.fn();
jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  GamePenalty: {
    findAll: penaltyFindAllMock,
    create: penaltyCreateMock,
    update: penaltyUpdateMock,
    sequelize: { transaction: transactionMock },
  },
  Match: { findByPk: matchFindByPkMock },
  GameEventType: { findOne: typeFindOneMock },
  Player: { findAll: playerFindAllMock },
  GameViolation: { findAll: violationFindAllMock },
  PenaltyMinutes: { findAll: minutesFindAllMock },
}));

const { reconcileForMatch } = await import(
  '../src/services/gamePenaltySyncService.js'
);

test('reconcileForMatch upserts and soft-deletes penalties by external_id', async () => {
  matchFindByPkMock.mockResolvedValueOnce({ id: 'm1', external_id: 123 });
  // First call in getExternalPenaltyTypeId: resolve external_id by name; second call: resolve local type by external_id
  typeFindOneMock.mockImplementation(async (opts) => {
    if (opts?.where?.name) return { external_id: 5 };
    if (opts?.where?.external_id === 5) return { id: 'evt1', external_id: 5 };
    return null;
  });
  extFindAllMock.mockResolvedValueOnce([
    {
      id: 1001,
      game_id: 123,
      event_type_id: 5,
      penalty_player_id: 77,
      penalty_violation_id: 10,
      minute: 12,
      second: 34,
      period: 2,
      penalty_minutes_id: 2,
      team_penalty: false,
    },
  ]);
  playerFindAllMock.mockResolvedValueOnce([{ id: 'p-uuid', external_id: 77 }]);
  violationFindAllMock.mockResolvedValueOnce([
    { id: 'v-uuid', external_id: 10 },
  ]);
  minutesFindAllMock.mockResolvedValueOnce([{ id: 'pm-uuid', external_id: 2 }]);
  penaltyFindAllMock.mockResolvedValueOnce([]);

  penaltyCreateMock.mockResolvedValueOnce({ id: 'gp1' });

  const res = await reconcileForMatch('m1', 'admin');
  expect(res.ok).toBe(true);
  expect(penaltyCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      external_id: 1001,
      game_id: 'm1',
      event_type_id: 'evt1',
      penalty_player_id: 'p-uuid',
      penalty_violation_id: 'v-uuid',
      penalty_minutes_id: 'pm-uuid',
      minute: 12,
      second: 34,
      period: 2,
      team_penalty: false,
      created_by: 'admin',
      updated_by: 'admin',
    }),
    expect.objectContaining({ transaction: expect.any(Object) })
  );

  // Bulk soft-delete for match scope should be called (with notIn extIds)
  const calls = penaltyUpdateMock.mock.calls;
  const softCall = calls.find((c) => c?.[1]?.where?.game_id === 'm1');
  expect(softCall).toBeTruthy();
  expect(softCall[1].paranoid).toBe(false);
  expect(softCall[1].where.external_id[Op.notIn]).toEqual([1001]);
});
