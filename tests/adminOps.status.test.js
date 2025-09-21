import { beforeEach, expect, jest, test } from '@jest/globals';

// Bypass auth middlewares
jest.unstable_mockModule('../src/middlewares/auth.js', () => ({
  __esModule: true,
  default: (_req, _res, next) => next(),
}));
jest.unstable_mockModule('../src/middlewares/authorize.js', () => ({
  __esModule: true,
  default: () => (_req, _res, next) => next(),
}));

const getJobStatsMock = jest.fn();
const getSyncStatesMock = jest.fn();
jest.unstable_mockModule('../src/config/metrics.js', () => ({
  __esModule: true,
  getJobStats: (...args) => getJobStatsMock(...args),
}));
jest.unstable_mockModule('../src/services/syncStateService.js', () => ({
  __esModule: true,
  getSyncStates: (...args) => getSyncStatesMock(...args),
}));

const jobLogFindAllMock = jest.fn();
jest.unstable_mockModule('../src/models/jobLog.js', () => ({
  __esModule: true,
  default: { findAll: jobLogFindAllMock },
}));

// Cron modules
jest.unstable_mockModule('../src/jobs/syncAllCron.js', () => ({
  __esModule: true,
  isSyncAllRunning: () => true,
  runSyncAll: () => Promise.resolve(),
}));
jest.unstable_mockModule('../src/jobs/taxationCron.js', () => ({
  __esModule: true,
  isTaxationRunning: () => true,
  runTaxationCheck: () => Promise.resolve(),
}));

const router = (await import('../src/routes/adminOps.js')).default;

function findRoute(path, method) {
  const layer = router.stack.find(
    (l) => l?.route && l.route?.path === path && l.route?.methods?.[method]
  );
  if (!layer)
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

beforeEach(() => {
  getJobStatsMock.mockReset().mockResolvedValue({ ok: true });
  getSyncStatesMock.mockReset().mockResolvedValue({});
  jobLogFindAllMock.mockReset().mockResolvedValue([]);
});

test('GET /admin-ops/sync/status returns stats and running flag', async () => {
  const handler = findRoute('/sync/status', 'get');
  let captured;
  const res = {
    json: (p) => (captured = p),
    status: () => ({ json: (p) => (captured = p) }),
  };
  await handler({}, res);
  expect(getJobStatsMock).toHaveBeenCalled();
  expect(captured.jobs).toBeDefined();
  expect(captured.states).toBeDefined();
  expect(captured.running.syncAll).toBe(true);
});

test('GET /admin-ops/sync/status handles metrics error', async () => {
  getJobStatsMock.mockRejectedValue(new Error('boom'));
  const handler = findRoute('/sync/status', 'get');
  let captured;
  const res = {
    status: (c) => ({ json: (p) => (captured = { code: c, body: p }) }),
  };
  await handler({}, res);
  expect(captured.code).toBe(500);
  expect(captured.body.error).toBe('metrics_error');
});

test('POST /admin-ops/sync/run queues job', async () => {
  const handler = findRoute('/sync/run', 'post');
  let captured;
  const res = {
    status: (c) => ({ json: (p) => (captured = { code: c, body: p }) }),
  };
  await handler({}, res);
  expect(captured.code).toBe(202);
  expect(captured.body.queued).toBe(true);
});

test('GET /admin-ops/taxation/status returns stats and running flag', async () => {
  const handler = findRoute('/taxation/status', 'get');
  let captured;
  const res = {
    json: (p) => (captured = p),
    status: () => ({ json: (p) => (captured = p) }),
  };
  await handler({}, res);
  expect(getJobStatsMock).toHaveBeenCalled();
  expect(captured.states).toBeDefined();
  expect(captured.running.taxation).toBe(true);
});

test('POST /admin-ops/taxation/run queues job with batch', async () => {
  const handler = findRoute('/taxation/run', 'post');
  let captured;
  const res = {
    status: (c) => ({ json: (p) => (captured = { code: c, body: p }) }),
  };
  await handler({ body: { batch: 5 } }, res);
  expect(captured.code).toBe(202);
  expect(captured.body.queued).toBe(true);
});
