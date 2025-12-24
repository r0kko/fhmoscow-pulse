import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const xAdd = jest.fn();
const xAck = jest.fn();
const xReadGroup = jest.fn();
const del = jest.fn();
const xAutoClaim = jest.fn();
const xLen = jest.fn();
const zCard = jest.fn();

jest.unstable_mockModule('../src/config/redis.js', () => ({
  __esModule: true,
  createRedisClient: () => ({}),
}));

const metrics = {
  incEmailQueueFailure: jest.fn(),
  incEmailQueueRetry: jest.fn(),
  incEmailQueued: jest.fn(),
  setEmailQueueDepthBucket: jest.fn(),
};

jest.unstable_mockModule('../src/config/metrics.js', () => ({
  __esModule: true,
  ...metrics,
}));

jest.unstable_mockModule('../src/services/email/emailTransport.js', () => ({
  __esModule: true,
  deliverEmail: jest.fn().mockRejectedValue(new Error('fail')),
  isEmailConfigured: true,
}));

const { __testables } = await import('../src/services/email/emailQueue.js');

beforeEach(() => {
  xAdd.mockReset();
  xAck.mockReset();
  xReadGroup.mockReset();
  del.mockReset();
  xAutoClaim.mockReset();
  xLen.mockReset();
  zCard.mockReset();
  Object.values(metrics).forEach((fn) => fn.mockReset?.());
});

afterEach(async () => {
  jest.restoreAllMocks();
});

test('processRecord sends failing job to DLQ and acknowledges', async () => {
  __testables.setInitializedForTests(true);
  __testables.setClientsForTests({
    producer: { xAdd, del, xLen, zCard },
    consumer: { xAck, xAutoClaim },
    scheduler: {
      zRangeByScore: jest.fn().mockResolvedValue([]),
      multi: jest.fn(),
    },
  });
  const payload = { id: 'j1', maxAttempts: 1 };
  const record = {
    id: '1-1',
    message: { payload: __testables.encode(payload) },
  };
  await __testables.processRecord(record);
  expect(xAck).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(String),
    '1-1'
  );
  expect(xAdd).toHaveBeenCalledWith(expect.stringContaining(':dlq'), '*', {
    payload: expect.any(String),
  });
  expect(metrics.incEmailQueueFailure).toHaveBeenCalled();
});

test('recoverPending reprocesses claimed messages after visibility timeout', async () => {
  __testables.setInitializedForTests(true);
  const record = {
    id: '2-2',
    message: { payload: JSON.stringify({ id: 'retry' }) },
  };
  __testables.setClientsForTests({
    producer: { xAdd, del, xLen, zCard },
    consumer: {
      xAck,
      xAutoClaim: jest
        .fn()
        .mockResolvedValue({ messages: [record], nextId: '0-0' }),
      xReadGroup,
    },
    scheduler: {
      zRangeByScore: jest.fn().mockResolvedValue([]),
      multi: jest.fn(),
      zAdd: jest.fn(),
    },
  });
  __testables.setRunningForTests(true);
  await __testables.recoverPending();
  expect(xAck).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(String),
    '2-2'
  );
});
