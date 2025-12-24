import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const deliverEmail = jest.fn();
const isEmailConfigured = true;
const incEmailQueued = jest.fn();
const setBucket = jest.fn();
const incRetry = jest.fn();
const incFailure = jest.fn();

const xAck = jest.fn();
const xAdd = jest.fn();
const xReadGroup = jest.fn();
const xAutoClaim = jest.fn();
const zAdd = jest.fn();
const zRangeByScore = jest.fn();
const zRem = jest.fn();
const multiExec = jest.fn().mockResolvedValue([]);
const multi = jest.fn(() => ({ zRem, xAdd, exec: multiExec }));
const del = jest.fn();

beforeEach(() => {
  jest.resetModules();
  deliverEmail.mockReset();
  incEmailQueued.mockReset();
  setBucket.mockReset();
  incRetry.mockReset();
  incFailure.mockReset();
  xAck.mockReset();
  xAdd.mockReset();
  xReadGroup.mockReset();
  xAutoClaim.mockReset();
  zAdd.mockReset();
  zRangeByScore.mockReset();
  zRem.mockReset();
  multiExec.mockReset();
  multi.mockClear();
  del.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

jest.unstable_mockModule('../src/config/redis.js', () => ({
  __esModule: true,
  createRedisClient: () => ({}),
}));

jest.unstable_mockModule('../src/services/email/emailTransport.js', () => ({
  __esModule: true,
  deliverEmail,
  isEmailConfigured,
}));

jest.unstable_mockModule('../src/config/metrics.js', () => ({
  __esModule: true,
  incEmailQueued,
  setEmailQueueDepthBucket: setBucket,
  incEmailQueueRetry: incRetry,
  incEmailQueueFailure: incFailure,
}));

const { __testables } = await import('../src/services/email/emailQueue.js');

describe('emailQueue worker paths', () => {
  test('processRecord reschedules future job and acknowledges malformed payload', async () => {
    const job = { id: 'future', availableAfter: Date.now() + 10000 };
    const futureRecord = {
      id: '1-1',
      message: { payload: JSON.stringify(job) },
    };
    const badRecord = { id: '1-2', message: { payload: '{bad' } };
    const scheduleSpy = jest.fn();
    const ackSpy = jest.fn();
    __testables.setClientsForTests({
      consumer: { xAck: ackSpy },
      scheduler: { zAdd: scheduleSpy },
      producer: { del },
    });
    await __testables.processRecord(futureRecord);
    await __testables.processRecord(badRecord);
    expect(scheduleSpy).toHaveBeenCalled();
    expect(ackSpy).toHaveBeenCalledTimes(2);
  });

  test('handleFailure moves job to DLQ after max attempts', async () => {
    __testables.setClientsForTests({
      consumer: { xAck },
      producer: { xAdd, del },
    });
    const job = {
      id: 'job1',
      purpose: 'test',
      maxAttempts: 1,
      dedupeKey: 'k1',
    };
    await __testables.handleFailure('1-0', job, new Error('boom'));
    expect(xAdd).toHaveBeenCalledWith(expect.stringContaining('dlq'), '*', {
      payload: expect.any(String),
    });
    expect(incFailure).toHaveBeenCalled();
    expect(del).toHaveBeenCalled();
  });

  test('workerLoop processes stream messages and stops when running cleared', async () => {
    const job = { id: 'work-1' };
    __testables.setClientsForTests({
      producer: { del, xLen: jest.fn(), xAdd },
      consumer: {
        xReadGroup: async () => {
          __testables.setRunningForTests(false);
          return [
            {
              messages: [
                { id: '2-1', message: { payload: JSON.stringify(job) } },
              ],
            },
          ];
        },
        xAck,
        xAutoClaim: xAutoClaim.mockResolvedValue({ messages: [] }),
      },
      scheduler: { zRangeByScore: zRangeByScore.mockResolvedValue([]), multi },
    });
    __testables.setRunningForTests(true);
    deliverEmail.mockResolvedValueOnce({});
    await __testables.workerLoop('slot-1');
    expect(xAck).toHaveBeenCalled();
  });
});
