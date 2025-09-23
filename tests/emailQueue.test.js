import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const originalEnv = { ...process.env };

function createRedisStub() {
  const store = new Map();
  return {
    connect: jest.fn(async () => {}),
    quit: jest.fn(async () => {}),
    set: jest.fn(async (key, value, options = {}) => {
      if (options.NX) {
        if (store.has(key)) return null;
      }
      store.set(key, value);
      return 'OK';
    }),
    get: jest.fn(async (key) => store.get(key) ?? null),
    del: jest.fn(async (key) => {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    }),
    pExpire: jest.fn(async (key, _ttl) => (store.has(key) ? 1 : 0)),
    xAdd: jest.fn(async () => '1-0'),
    zAdd: jest.fn(async () => 1),
    xGroupCreate: jest.fn(async () => 'OK'),
    xLen: jest.fn(async () => 0),
    zCard: jest.fn(async () => 0),
    xReadGroup: jest.fn(async () => null),
    xAck: jest.fn(async () => 1),
    xAutoClaim: jest.fn(async () => ({ nextId: '0-0', messages: [] })),
    multi: jest.fn(() => ({ exec: jest.fn(async () => []) })),
  };
}

describe('emailQueue deduplication', () => {
  let queueModule;
  let producer;
  let consumer;
  let scheduler;

  beforeEach(async () => {
    jest.resetModules();
    producer = createRedisStub();
    consumer = createRedisStub();
    scheduler = createRedisStub();
    Object.assign(process.env, originalEnv, {
      SMTP_HOST: 'smtp.test',
      EMAIL_QUEUE_DEDUPE_ENABLED: 'true',
      EMAIL_QUEUE_DEDUPE_TTL_MS: '60000',
      EMAIL_QUEUE_DEDUPE_GRACE_MS: '1000',
    });

    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      createRedisClient: jest
        .fn()
        .mockImplementationOnce(() => producer)
        .mockImplementationOnce(() => consumer)
        .mockImplementationOnce(() => scheduler),
    }));

    jest.unstable_mockModule('../src/services/email/emailTransport.js', () => ({
      __esModule: true,
      isEmailConfigured: true,
      deliverEmail: jest.fn(async () => ({})),
    }));

    queueModule = await import('../src/services/email/emailQueue.js');
  });

  afterEach(async () => {
    await queueModule.stopEmailWorker();
    Object.assign(process.env, originalEnv);
    jest.resetModules();
  });

  test('prevents duplicate jobs while prior job pending', async () => {
    const payload = {
      to: 'person@test',
      subject: 'Subject',
      text: 'Body',
      html: '<div>Body</div>',
      purpose: 'verification',
    };

    const first = await queueModule.enqueueEmail(payload);
    expect(first.accepted).toBe(true);

    const second = await queueModule.enqueueEmail(payload);
    expect(second.accepted).toBe(false);
    expect(second.reason).toBe('duplicate');
    expect(producer.set).toHaveBeenCalled();
  });
});
