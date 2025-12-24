import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const xLen = jest.fn();
const zCard = jest.fn();
const xAdd = jest.fn();
const xAck = jest.fn();
const zRangeByScore = jest.fn();
const zRem = jest.fn();
const multiExec = jest.fn().mockResolvedValue([]);
const multi = jest.fn(() => ({ xAdd, zRem, exec: multiExec }));
const deliverEmail = jest.fn();

jest.unstable_mockModule('../src/config/redis.js', () => ({
  __esModule: true,
  createRedisClient: () => ({}),
}));

jest.unstable_mockModule('../src/services/email/emailTransport.js', () => ({
  __esModule: true,
  deliverEmail,
  isEmailConfigured: true,
}));

const metrics = {
  setEmailQueueDepthBucket: jest.fn(),
  incEmailQueueRetry: jest.fn(),
  incEmailQueueFailure: jest.fn(),
  incEmailQueued: jest.fn(),
  incEmailSent: jest.fn(),
};

jest.unstable_mockModule('../src/config/metrics.js', () => ({
  __esModule: true,
  ...metrics,
}));

const { __testables } = await import('../src/services/email/emailQueue.js');

beforeEach(() => {
  xLen.mockReset();
  zCard.mockReset();
  xAdd.mockReset();
  xAck.mockReset();
  zRangeByScore.mockReset();
  zRem.mockReset();
  multiExec.mockReset();
  multi.mockClear();
  deliverEmail.mockReset();
  Object.values(metrics).forEach((fn) => fn.mockReset?.());
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('emitQueueMetrics reads stream lengths and sets buckets', async () => {
  __testables.setClientsForTests({
    producer: { xLen },
    scheduler: { zCard },
  });
  __testables.setInitializedForTests(true);
  xLen.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
  zCard.mockResolvedValueOnce(3);
  await __testables.emitQueueMetrics();
  expect(metrics.setEmailQueueDepthBucket).toHaveBeenCalledWith('ready', 2);
  expect(metrics.setEmailQueueDepthBucket).toHaveBeenCalledWith('scheduled', 3);
  expect(metrics.setEmailQueueDepthBucket).toHaveBeenCalledWith(
    'dead_letter',
    1
  );
});

test('promoteScheduled moves due jobs into stream respecting trim', async () => {
  const payload = JSON.stringify({ id: 'job' });
  __testables.setClientsForTests({
    scheduler: {
      zRangeByScore: zRangeByScore.mockResolvedValue([payload]),
      multi,
    },
    producer: { xLen, xAdd },
    consumer: { xAck },
  });
  await __testables.promoteScheduled(10);
  expect(zRem).toHaveBeenCalled();
  expect(xAdd).toHaveBeenCalled();
  expect(multiExec).toHaveBeenCalled();
});

test('recoverPending reclaims messages via xAutoClaim and processes', async () => {
  const record = {
    id: '1-1',
    message: { payload: JSON.stringify({ id: 'r1' }) },
  };
  deliverEmail.mockResolvedValue({});
  __testables.setClientsForTests({
    consumer: {
      xAutoClaim: jest
        .fn()
        .mockResolvedValue({ messages: [record], nextId: '0-0' }),
      xAck,
      xReadGroup: jest.fn(),
    },
    producer: { del: jest.fn(), xAdd, xLen },
    scheduler: { zRangeByScore: jest.fn(), multi },
  });
  __testables.setRunningForTests(true);
  await __testables.recoverPending();
  expect(xAck).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(String),
    '1-1'
  );
});
