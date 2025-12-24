import { beforeEach, expect, jest, test } from '@jest/globals';

const findByPkMatchMock = jest.fn();
const matchFindAllMock = jest.fn();
const findByPkExtGameMock = jest.fn();
const findAllExtGameMock = jest.fn();
const linkFindAllMock = jest.fn();
const linkCreateMock = jest.fn();
const transactionMock = jest.fn();
let lastTx;

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: {
    findByPk: findByPkMatchMock,
    findAll: matchFindAllMock,
  },
  MatchBroadcastLink: {
    findAll: linkFindAllMock,
    create: linkCreateMock,
  },
}));

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Game: {
    findByPk: findByPkExtGameMock,
    findAll: findAllExtGameMock,
  },
}));

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: {
    transaction: transactionMock,
  },
}));

const { reconcileForMatch, reconcileWindow } =
  await import('../src/services/broadcastSyncService.js');

beforeEach(() => {
  findByPkMatchMock.mockReset();
  matchFindAllMock.mockReset();
  findByPkExtGameMock.mockReset();
  findAllExtGameMock.mockReset();
  linkFindAllMock.mockReset();
  linkCreateMock.mockReset();
  lastTx = { id: 'tx' };
  transactionMock
    .mockReset()
    .mockImplementation(async (handler) => handler(lastTx));
});

test('reconcileForMatch soft-deletes local link when external URL is removed', async () => {
  findByPkMatchMock.mockResolvedValue({ id: 'm1', external_id: 101 });
  findByPkExtGameMock.mockResolvedValue({
    id: 101,
    broadcast: '',
    broadcast2: null,
  });
  const destroy = jest.fn();
  const update = jest.fn();
  linkFindAllMock.mockResolvedValue([
    {
      match_id: 'm1',
      position: 1,
      url: 'https://legacy',
      deletedAt: null,
      update,
      destroy,
    },
  ]);

  const res = await reconcileForMatch('m1', 'admin');
  expect(res).toEqual({ ok: true });
  expect(update).toHaveBeenCalledWith(
    { updated_by: 'admin' },
    { transaction: null }
  );
  expect(destroy).toHaveBeenCalledWith({ transaction: null });
});

test('reconcileWindow returns zero stats when nothing to process', async () => {
  matchFindAllMock.mockResolvedValue([]);
  const res = await reconcileWindow();
  expect(res).toEqual({ processed: 0, updated: 0, deleted: 0 });
  expect(transactionMock).not.toHaveBeenCalled();
});

test('reconcileWindow reconciles desired links across matches', async () => {
  const now = new Date();
  matchFindAllMock.mockResolvedValue([
    { id: 'm1', external_id: 1, date_start: now },
    { id: 'm2', external_id: 2, date_start: now },
  ]);
  findAllExtGameMock.mockResolvedValue([
    { id: 1, broadcast: 'https://one', broadcast2: null },
    { id: 2, broadcast: 'https://two', broadcast2: 'https://two-alt' },
  ]);
  const link1 = {
    match_id: 'm1',
    position: 1,
    url: 'https://old',
    deletedAt: null,
    update: jest.fn(),
    destroy: jest.fn(),
    restore: jest.fn(),
  };
  const link2 = {
    match_id: 'm2',
    position: 2,
    url: 'https://other',
    deletedAt: true,
    update: jest.fn(),
    destroy: jest.fn(),
    restore: jest.fn(),
  };
  linkFindAllMock.mockResolvedValue([link1, link2]);

  const res = await reconcileWindow({
    daysAhead: 1,
    daysBack: 1,
    limit: 10,
    actorId: 'admin',
  });

  expect(transactionMock).toHaveBeenCalledTimes(1);
  expect(linkCreateMock).toHaveBeenCalledWith(
    {
      match_id: 'm2',
      position: 1,
      url: 'https://two',
      created_by: 'admin',
      updated_by: 'admin',
    },
    { transaction: lastTx }
  );
  expect(link1.update).toHaveBeenCalledWith(
    { url: 'https://one', updated_by: 'admin' },
    { transaction: lastTx }
  );
  expect(link2.restore).toHaveBeenCalledWith({ transaction: lastTx });
  expect(link2.update).toHaveBeenCalledWith(
    { url: 'https://two-alt', updated_by: 'admin' },
    { transaction: lastTx }
  );
  expect(res).toEqual({ processed: 2, updated: 3, deleted: 0 });
});
