import {
  jest,
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

const incEmailQueuedMock = jest.fn();
const setEmailQueueDepthBucketMock = jest.fn();
const incEmailQueueRetryMock = jest.fn();
const incEmailQueueFailureMock = jest.fn();
const deliverEmailMock = jest.fn();
const createRedisClientMock = jest.fn();
const loggerInfoMock = jest.fn();
const loggerWarnMock = jest.fn();
const loggerErrorMock = jest.fn();
const loggerDebugMock = jest.fn();
let isEmailConfiguredValue = true;

let queueModule;
let testables;

async function loadQueueModule(envOverrides = {}) {
  jest.resetModules();
  process.env = {
    ...ORIGINAL_ENV,
    EMAIL_QUEUE_DEDUPE_ENABLED: 'true',
    EMAIL_QUEUE_RETRY_BASE_MS: '1000',
    EMAIL_QUEUE_RETRY_MAX_MS: '60000',
    EMAIL_QUEUE_DEDUPE_TTL_MS: '3600000',
    ...envOverrides,
  };

  incEmailQueuedMock.mockReset();
  setEmailQueueDepthBucketMock.mockReset();
  incEmailQueueRetryMock.mockReset();
  incEmailQueueFailureMock.mockReset();
  deliverEmailMock.mockReset();
  createRedisClientMock.mockReset();
  loggerInfoMock.mockReset();
  loggerWarnMock.mockReset();
  loggerErrorMock.mockReset();
  loggerDebugMock.mockReset();

  jest.unstable_mockModule('../src/config/metrics.js', () => ({
    __esModule: true,
    incEmailQueued: incEmailQueuedMock,
    setEmailQueueDepthBucket: setEmailQueueDepthBucketMock,
    incEmailQueueRetry: incEmailQueueRetryMock,
    incEmailQueueFailure: incEmailQueueFailureMock,
  }));
  jest.unstable_mockModule('../src/services/email/emailTransport.js', () => ({
    __esModule: true,
    deliverEmail: deliverEmailMock,
    isEmailConfigured: isEmailConfiguredValue,
  }));
  jest.unstable_mockModule('../src/config/redis.js', () => ({
    __esModule: true,
    createRedisClient: createRedisClientMock,
  }));
  jest.unstable_mockModule('../logger.js', () => ({
    __esModule: true,
    default: {
      info: loggerInfoMock,
      warn: loggerWarnMock,
      error: loggerErrorMock,
      debug: loggerDebugMock,
    },
  }));

  queueModule = await import('../src/services/email/emailQueue.js');
  testables = queueModule.__testables;
  testables.resetStateForTests();
}

beforeEach(async () => {
  isEmailConfiguredValue = true;
  await loadQueueModule();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('emailQueue internals', () => {
  test('computeBackoff grows exponentially up to configured cap', () => {
    expect(testables.computeBackoff(1)).toBe(1000);
    expect(testables.computeBackoff(3)).toBe(4000);
    expect(testables.computeBackoff(10)).toBe(60000);
  });

  test('normalizeDedupeKey hashes payload fallback', () => {
    const key = testables.normalizeDedupeKey(
      null,
      {
        to: 'a@example.com',
        subject: 'Hello',
      },
      'welcome'
    );
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(testables.dedupeRedisKey(key)).toContain(key);
  });

  test('buildJob merges defaults and delay options', () => {
    const job = testables.buildJob(
      { to: 'a@example.com', subject: 'Hi', delayMs: 2000 },
      { purpose: 'welcome', maxAttempts: 3 }
    );
    expect(job.purpose).toBe('welcome');
    expect(job.delayMs).toBe(2000);
    expect(job.availableAfter).toBeGreaterThan(Date.now());
    expect(job.maxAttempts).toBe(3);
    expect(job.dedupeKey).toBeTruthy();
  });

  test('dedupeTtlForJob accounts for future availability and grace period', () => {
    const future = Date.now() + 5000;
    const job = { dedupeTtlMs: 1000, availableAfter: future, delayMs: 2000 };
    const ttl = testables.dedupeTtlForJob(job);
    expect(ttl).toBeGreaterThan(5000);
  });

  test('acquireDedupeLock returns existing job when lock already present', async () => {
    const store = new Map();
    const producerStub = {
      set: jest.fn(async (key, value, options) => {
        if (options?.NX && store.has(key)) return null;
        store.set(key, value);
        return 'OK';
      }),
      get: jest.fn(async (key) => store.get(key)),
      pExpire: jest.fn(async () => 1),
    };
    testables.setClientsForTests({ producer: producerStub });
    const job = testables.buildJob(
      { to: 'b@example.com', subject: 'Hi' },
      { purpose: 'digest', dedupeKey: 'manual-key' }
    );
    const redisDedupeKey = testables.dedupeRedisKey(job.dedupeKey);
    store.set(redisDedupeKey, 'job-existing');

    const result = await testables.acquireDedupeLock(job);
    expect(result).toEqual({ acquired: false, existingJobId: 'job-existing' });
  });

  test('enqueueEmail exits early when SMTP disabled', async () => {
    isEmailConfiguredValue = false;
    await loadQueueModule();
    const res = await queueModule.enqueueEmail(
      { to: 'user@example.com', subject: 'Hello' },
      { purpose: 'digest' }
    );
    expect(res).toEqual({ accepted: false, reason: 'not_configured' });
    expect(incEmailQueuedMock).toHaveBeenCalledWith('skipped', 'digest');
    expect(loggerWarnMock).toHaveBeenCalledWith('Email not configured');
  });

  test('enqueueEmail deduplicates existing job and reports duplicate metric', async () => {
    const producerStub = (() => {
      const store = new Map();
      return {
        set: jest.fn(async (key, value, options) => {
          if (options?.NX && store.has(key)) return null;
          store.set(key, value);
          return 'OK';
        }),
        get: jest.fn(async (key) => store.get(key)),
        pExpire: jest.fn(async () => 1),
        xAdd: jest.fn(async () => {}),
        xLen: jest.fn(async () => 0),
        quit: jest.fn(async () => {}),
      };
    })();
    const consumerStub = {
      xAck: jest.fn(async () => {}),
      quit: jest.fn(async () => {}),
    };
    const schedulerStub = {
      zAdd: jest.fn(async () => 1),
      zRangeByScore: jest.fn(async () => []),
      zCard: jest.fn(async () => 0),
      multi: jest.fn(() => ({
        zRem() {
          return this;
        },
        xAdd() {
          return this;
        },
        exec: jest.fn(async () => []),
      })),
      quit: jest.fn(async () => {}),
    };

    const payload = { to: 'dup@example.com', subject: 'Dup', html: '<p>' };
    const previewJob = testables.buildJob(payload, { purpose: 'digest' });
    const redisKey = testables.dedupeRedisKey(previewJob.dedupeKey);
    producerStub.set(redisKey, 'existing-job');

    testables.setClientsForTests({
      producer: producerStub,
      consumer: consumerStub,
      scheduler: schedulerStub,
    });
    testables.setInitializedForTests(true);

    const res = await queueModule.enqueueEmail(payload, { purpose: 'digest' });
    expect(res.accepted).toBe(false);
    expect(res.reason).toBe('duplicate');
    expect(res.jobId).toBe('existing-job');
    expect(incEmailQueuedMock).toHaveBeenCalledWith('duplicate', 'digest');
  });
});
