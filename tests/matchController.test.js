import { beforeEach, expect, jest, test } from '@jest/globals';

const listUpcomingMock = jest.fn();
const listUpcomingLocalMock = jest.fn();

jest.unstable_mockModule('../src/services/matchService.js', () => ({
  __esModule: true,
  default: { listUpcoming: listUpcomingMock },
  listUpcomingLocal: listUpcomingLocalMock,
}));

jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
  __esModule: true,
  isExternalDbAvailable: () => false,
}));

const { default: controller } =
  await import('../src/controllers/matchController.js');

beforeEach(() => {
  listUpcomingMock.mockReset();
  listUpcomingLocalMock.mockReset();
});

test('matchController falls back to local when external is unavailable', async () => {
  listUpcomingLocalMock.mockResolvedValue({
    rows: [
      {
        id: 'm1',
        date: new Date('2025-07-01T10:00:00Z'),
        stadium: 'Arena',
        team1: 'A',
        team2: 'B',
        is_home: true,
      },
    ],
    count: 1,
  });
  const req = {
    query: { page: '1', limit: '10', type: 'home', q: '' },
    user: { id: 'u1' },
  };
  const json = jest.fn();
  const res = { json };
  const next = jest.fn();

  await controller.listUpcoming(req, res, next);

  expect(listUpcomingLocalMock).toHaveBeenCalled();
  expect(json).toHaveBeenCalledWith(
    expect.objectContaining({
      external_available: false,
      page: 1,
      total_pages: 1,
    })
  );
});

test('matchController uses external when available', async () => {
  // Re-mock module to return true for this test
  jest.resetModules();
  jest.unstable_mockModule('../src/services/matchService.js', () => ({
    __esModule: true,
    default: { listUpcoming: listUpcomingMock },
    listUpcomingLocal: listUpcomingLocalMock,
  }));
  jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
    __esModule: true,
    isExternalDbAvailable: () => true,
  }));
  const { default: controller2 } =
    await import('../src/controllers/matchController.js');
  listUpcomingMock.mockResolvedValue({ rows: [], count: 0 });

  const req = {
    query: { page: '2', limit: '5', type: 'away', q: 'x' },
    user: { id: 'u2' },
  };
  const json = jest.fn();
  const res = { json };
  const next = jest.fn();

  await controller2.listUpcoming(req, res, next);
  expect(listUpcomingMock).toHaveBeenCalled();
  expect(json).toHaveBeenCalledWith(
    expect.objectContaining({ external_available: true, page: 2 })
  );
});

test('matchController forces local when source=local even if external is available', async () => {
  jest.resetModules();
  const listUpcomingLocalMock2 = jest
    .fn()
    .mockResolvedValue({ rows: [{ id: 'x' }], count: 1 });
  jest.unstable_mockModule('../src/services/matchService.js', () => ({
    __esModule: true,
    default: { listUpcoming: jest.fn() },
    listUpcomingLocal: listUpcomingLocalMock2,
  }));
  jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
    __esModule: true,
    isExternalDbAvailable: () => true,
  }));
  const { default: controllerX } =
    await import('../src/controllers/matchController.js');
  const req = { query: { source: 'local', all: 'true' }, user: { id: 'u6' } };
  const json = jest.fn();
  const res = { json };
  await controllerX.listUpcoming(req, res, () => {});
  expect(listUpcomingLocalMock2).toHaveBeenCalled();
  expect(json).toHaveBeenCalledWith(
    expect.objectContaining({ external_available: false })
  );
});

test('matchController computes total_pages=1 when all=true', async () => {
  jest.resetModules();
  jest.unstable_mockModule('../src/services/matchService.js', () => ({
    __esModule: true,
    default: { listUpcoming: async () => ({ rows: [1, 2, 3], count: 3 }) },
    listUpcomingLocal: listUpcomingLocalMock,
  }));
  jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
    __esModule: true,
    isExternalDbAvailable: () => true,
  }));
  const { default: controller3 } =
    await import('../src/controllers/matchController.js');
  const req = { query: { all: 'true' }, user: { id: 'u3' } };
  const json = jest.fn();
  const res = { json };
  await controller3.listUpcoming(req, res, () => {});
  expect(json).toHaveBeenCalledWith(
    expect.objectContaining({ total_pages: 1 })
  );
});

test('matchController forwards errors via next()', async () => {
  jest.resetModules();
  const err = new Error('boom');
  jest.unstable_mockModule('../src/services/matchService.js', () => ({
    __esModule: true,
    default: {
      listUpcoming: async () => {
        throw err;
      },
    },
    listUpcomingLocal: async () => {
      throw err;
    },
  }));
  jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
    __esModule: true,
    isExternalDbAvailable: () => true,
  }));
  const { default: controller4 } =
    await import('../src/controllers/matchController.js');

  const req = { query: {}, user: { id: 'u4' } };
  const json = jest.fn();
  const res = { json };
  const next = jest.fn();
  await controller4.listUpcoming(req, res, next);
  expect(next).toHaveBeenCalledWith(err);
});

test('matchController defaults to type=all on invalid type', async () => {
  jest.resetModules();
  const spy = jest.fn().mockResolvedValue({ rows: [], count: 0 });
  jest.unstable_mockModule('../src/services/matchService.js', () => ({
    __esModule: true,
    default: { listUpcoming: spy },
    listUpcomingLocal: listUpcomingLocalMock,
  }));
  jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
    __esModule: true,
    isExternalDbAvailable: () => true,
  }));
  const { default: controller5 } =
    await import('../src/controllers/matchController.js');
  const req = { query: { type: 'weird' }, user: { id: 'u5' } };
  const json = jest.fn();
  const res = { json };
  await controller5.listUpcoming(req, res, () => {});
  const calledWith = spy.mock.calls[0][1];
  expect(calledWith.type).toBe('all');
});
