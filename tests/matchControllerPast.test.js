import { beforeEach, expect, jest, test } from '@jest/globals';

const listPastMock = jest.fn();
const listPastLocalMock = jest.fn();

jest.unstable_mockModule('../src/services/matchService.js', () => ({
  __esModule: true,
  default: { listPast: listPastMock, listPastLocal: listPastLocalMock },
  // Provide named export used by controller import (not used in this suite)
  listUpcomingLocal: jest.fn(),
}));

// Start with external unavailable
jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
  __esModule: true,
  isExternalDbAvailable: () => false,
}));

const { default: controller } = await import(
  '../src/controllers/matchController.js'
);

beforeEach(() => {
  listPastMock.mockReset();
  listPastLocalMock.mockReset();
});

test('listPast falls back to local when external is unavailable', async () => {
  listPastLocalMock.mockResolvedValue({ rows: [{ id: 'p1' }], count: 1 });
  const req = {
    query: { page: '1', limit: '10', type: 'home', q: 'x', season_id: 's1' },
    user: { id: 'u' },
  };
  const res = { json: jest.fn() };
  await controller.listPast(req, res, () => {});
  expect(listPastLocalMock).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      external_available: false,
      total_pages: 1,
      page: 1,
    })
  );
});

test('listPast uses external when available', async () => {
  jest.resetModules();
  const listPastMock2 = jest.fn().mockResolvedValue({ rows: [], count: 0 });
  jest.unstable_mockModule('../src/services/matchService.js', () => ({
    __esModule: true,
    default: { listPast: listPastMock2, listPastLocal: listPastLocalMock },
    listUpcomingLocal: jest.fn(),
  }));
  jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
    __esModule: true,
    isExternalDbAvailable: () => true,
  }));
  const { default: controller2 } = await import(
    '../src/controllers/matchController.js'
  );
  const req = {
    query: { page: '2', limit: '5', type: 'away', q: 'k' },
    user: { id: 'u' },
  };
  const res = { json: jest.fn() };
  await controller2.listPast(req, res, () => {});
  expect(listPastMock2).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ external_available: true, page: 2 })
  );
});

test('listPast forces local when source=local', async () => {
  jest.resetModules();
  const listPastLocalMock2 = jest
    .fn()
    .mockResolvedValue({ rows: [{ id: 'x' }], count: 1 });
  jest.unstable_mockModule('../src/services/matchService.js', () => ({
    __esModule: true,
    default: { listPast: jest.fn(), listPastLocal: listPastLocalMock2 },
    listUpcomingLocal: jest.fn(),
  }));
  jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
    __esModule: true,
    isExternalDbAvailable: () => true,
  }));
  const { default: controller3 } = await import(
    '../src/controllers/matchController.js'
  );
  const req = { query: { source: 'local', all: 'true' }, user: { id: 'u' } };
  const res = { json: jest.fn() };
  await controller3.listPast(req, res, () => {});
  expect(listPastLocalMock2).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ total_pages: 1, external_available: false })
  );
});

test('listPast forwards errors via next()', async () => {
  jest.resetModules();
  const err = new Error('boom');
  jest.unstable_mockModule('../src/services/matchService.js', () => ({
    __esModule: true,
    default: {
      listPast: async () => {
        throw err;
      },
      listPastLocal: async () => {
        throw err;
      },
    },
    listUpcomingLocal: jest.fn(),
  }));
  jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
    __esModule: true,
    isExternalDbAvailable: () => true,
  }));
  const { default: controller4 } = await import(
    '../src/controllers/matchController.js'
  );
  const next = jest.fn();
  await controller4.listPast(
    { query: {}, user: { id: 'u' } },
    { json: jest.fn() },
    next
  );
  expect(next).toHaveBeenCalledWith(err);
});
