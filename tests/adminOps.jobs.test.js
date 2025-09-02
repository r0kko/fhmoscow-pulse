import { beforeEach, expect, jest, test } from '@jest/globals';

// Bypass auth
jest.unstable_mockModule('../src/middlewares/auth.js', () => ({
  __esModule: true,
  default: (_req, _res, next) => next(),
}));
jest.unstable_mockModule('../src/middlewares/authorize.js', () => ({
  __esModule: true,
  default: () => (_req, _res, next) => next(),
}));

// Avoid touching real Redis
const forceDeleteLockMock = jest.fn(async () => true);
jest.unstable_mockModule('../src/utils/redisLock.js', () => ({
  __esModule: true,
  buildJobLockKey: (n) => `lock:job:${n}`,
  forceDeleteLock: (...args) => forceDeleteLockMock(...args),
}));

const router = (await import('../src/routes/adminOps.js')).default;

function findRoute(path, method) {
  const layer = router.stack.find(
    (l) => l?.route && l.route?.path === path && l.route?.methods?.[method]
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

beforeEach(() => {
  forceDeleteLockMock.mockReset().mockResolvedValue(true);
});

test('POST /admin-ops/jobs/reset rejects invalid job', async () => {
  const handler = findRoute('/jobs/reset', 'post');
  let captured;
  const req = { body: { job: 'nope' } };
  const res = { status: (c) => ({ json: (p) => (captured = { code: c, body: p }) }) };
  await handler(req, res);
  expect(captured.code).toBe(400);
  expect(captured.body.error).toBe('invalid_job');
});

test('POST /admin-ops/jobs/reset clears lock for syncAll', async () => {
  const handler = findRoute('/jobs/reset', 'post');
  const req = { body: { job: 'syncAll' } };
  const res = { json: jest.fn() };
  await handler(req, res);
  expect(forceDeleteLockMock).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalled();
});

test('POST /admin-ops/jobs/restart rejects non-restartable job', async () => {
  const handler = findRoute('/jobs/restart', 'post');
  let captured;
  const req = { body: { job: 'teamSync' } };
  const res = { status: (c) => ({ json: (p) => (captured = { code: c, body: p }) }) };
  await handler(req, res);
  expect(captured.code).toBe(400);
  expect(captured.body.error).toBe('job_not_restartable');
});

