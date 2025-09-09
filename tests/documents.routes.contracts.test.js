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

const listJudgesMock = jest.fn();
const precheckMock = jest.fn();
jest.unstable_mockModule(
  '../src/controllers/documentContractAdminController.js',
  () => ({
    __esModule: true,
    default: {
      listJudges: (...args) => listJudgesMock(...args),
      precheck: (...args) => precheckMock(...args),
    },
  })
);

const router = (await import('../src/routes/documents.js')).default;

function findRoute(path, method) {
  const layer = router.stack.find(
    (l) => l?.route && l.route?.path === path && l.route?.methods?.[method]
  );
  if (!layer)
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

beforeEach(() => {
  listJudgesMock
    .mockReset()
    .mockImplementation((_req, res) => res.json({ judges: [] }));
  precheckMock
    .mockReset()
    .mockImplementation((_req, res) => res.json({ precheck: { ok: true } }));
});

test('GET /documents/admin/contracts/judges route exists and returns json', async () => {
  const handler = findRoute('/admin/contracts/judges', 'get');
  let captured;
  const res = { json: (p) => (captured = p) };
  await handler({}, res);
  expect(captured).toEqual({ judges: [] });
  expect(listJudgesMock).toHaveBeenCalled();
});

test('GET /documents/admin/contracts/judges/:id/precheck route exists and returns json', async () => {
  const handler = findRoute('/admin/contracts/judges/:id/precheck', 'get');
  let captured;
  const res = { json: (p) => (captured = p) };
  await handler({ params: { id: 'u1' } }, res);
  expect(captured).toEqual({ precheck: { ok: true } });
  expect(precheckMock).toHaveBeenCalled();
});
