import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const baseEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...baseEnv };
  jest.resetModules();
});

afterEach(() => {
  process.env = { ...baseEnv };
});

async function loadTestables(overrides = {}) {
  process.env = { ...baseEnv, ...overrides };
  jest.resetModules();
  const mod = await import('../src/services/email/emailQueue.js');
  return mod.__testables;
}

describe('emailQueue __testables', () => {
  test('computeBackoff doubles until capped', async () => {
    const t = await loadTestables({
      EMAIL_QUEUE_RETRY_BASE_MS: '1000',
      EMAIL_QUEUE_RETRY_MAX_MS: '5000',
    });
    expect(t.computeBackoff(1)).toBe(1000);
    expect(t.computeBackoff(3)).toBe(4000);
    expect(t.computeBackoff(6)).toBe(5000);
  });

  test('buildJob derives dedupe key and respects delay/TTL', async () => {
    const t = await loadTestables({
      EMAIL_QUEUE_DEDUPE_TTL_MS: '1000',
      EMAIL_QUEUE_DEDUPE_GRACE_MS: '2000',
    });
    const job = t.buildJob(
      { to: 'user@example.com', subject: 'Hi', html: '<p>x</p>' },
      { delayMs: 5000 }
    );
    expect(job.dedupeKey).toHaveLength(64);
    expect(job.availableAfter).toBeGreaterThan(Date.now());
    expect(job.dedupeTtlMs).toBeGreaterThanOrEqual(7000); // delay + grace
  });

  test('dedupeTtlForJob extends TTL for scheduled jobs', async () => {
    const t = await loadTestables({
      EMAIL_QUEUE_DEDUPE_TTL_MS: '1000',
      EMAIL_QUEUE_DEDUPE_GRACE_MS: '2000',
    });
    const availableAfter = Date.now() + 3000;
    const job = {
      dedupeTtlMs: 1000,
      availableAfter,
      delayMs: 0,
    };
    expect(t.dedupeTtlForJob(job)).toBeGreaterThanOrEqual(5000);
  });

  test('acquireDedupeLock honors NX semantics and returns existing job id', async () => {
    const t = await loadTestables({
      EMAIL_QUEUE_DEDUPE_TTL_MS: '500',
      EMAIL_QUEUE_DEDUPE_GRACE_MS: '500',
    });
    const setMock = jest
      .fn()
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce(null);
    const getMock = jest.fn().mockResolvedValue('existing-job');
    t.setClientsForTests({
      producer: { set: setMock, get: getMock },
    });
    const job = { id: 'job-1', dedupeKey: 'abc' };
    const first = await t.acquireDedupeLock(job);
    expect(first).toMatchObject({ acquired: true, ttl: expect.any(Number) });
    const second = await t.acquireDedupeLock(job);
    expect(second).toEqual({ acquired: false, existingJobId: 'existing-job' });
  });

  test('refreshDedupeLock updates TTL and logs failures quietly', async () => {
    const t = await loadTestables({
      EMAIL_QUEUE_DEDUPE_TTL_MS: '1000',
      EMAIL_QUEUE_DEDUPE_GRACE_MS: '500',
    });
    const pExpire = jest.fn().mockResolvedValue(true);
    const logger = (await import('../logger.js')).default;
    const spy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
    t.setClientsForTests({ producer: { pExpire } });
    await t.refreshDedupeLock({
      id: 'id-1',
      dedupeKey: 'key-1',
      dedupeTtlMs: 1000,
    });
    expect(pExpire).toHaveBeenCalled();
    pExpire.mockRejectedValueOnce(new Error('boom'));
    await t.refreshDedupeLock({
      id: 'id-2',
      dedupeKey: 'key-2',
      dedupeTtlMs: 500,
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('releaseDedupeLock ignores missing keys and swallows errors', async () => {
    const t = await loadTestables();
    const del = jest.fn().mockRejectedValue(new Error('fail'));
    const logger = (await import('../logger.js')).default;
    const spy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
    t.setClientsForTests({ producer: { del } });
    await t.releaseDedupeLock({ dedupeKey: null });
    expect(del).not.toHaveBeenCalled();
    await t.releaseDedupeLock({ dedupeKey: 'abc' });
    expect(del).toHaveBeenCalledWith(expect.stringContaining('abc'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('decode returns null on malformed payload and logs error', async () => {
    const t = await loadTestables();
    const logger = (await import('../logger.js')).default;
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    expect(t.decode('{bad')).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
