import { beforeEach, expect, jest, test } from '@jest/globals';

const findByPkMatchMock = jest.fn();
const findByPkExtGameMock = jest.fn();
const findAllLinksMock = jest.fn();
const createLinkMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: findByPkMatchMock },
  MatchBroadcastLink: {
    findAll: findAllLinksMock,
    create: createLinkMock,
  },
}));

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Game: { findByPk: findByPkExtGameMock },
}));

const { reconcileForMatch } = await import(
  '../src/services/broadcastSyncService.js'
);

beforeEach(() => {
  findByPkMatchMock.mockReset();
  findByPkExtGameMock.mockReset();
  findAllLinksMock.mockReset();
  createLinkMock.mockReset();
});

test('reconcile soft-deletes local link when external URL is removed', async () => {
  // Local match mapped to external ID
  findByPkMatchMock.mockResolvedValue({ id: 'm1', external_id: 101 });
  // External game with no broadcast
  findByPkExtGameMock.mockResolvedValue({
    id: 101,
    broadcast: '',
    broadcast2: null,
  });
  // Local has an active link at position 1
  const destroy = jest.fn();
  const update = jest.fn();
  findAllLinksMock.mockResolvedValue([
    {
      match_id: 'm1',
      position: 1,
      url: 'https://x',
      deletedAt: null,
      update,
      destroy,
    },
  ]);
  const res = await reconcileForMatch('m1', 'admin');
  expect(res.ok).toBe(true);
  // updated_by set, then destroyed (soft-delete)
  expect(update).toHaveBeenCalled();
  expect(destroy).toHaveBeenCalled();
});
