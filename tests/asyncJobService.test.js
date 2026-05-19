import { beforeEach, expect, jest, test } from '@jest/globals';

const asyncJobFindByPk = jest.fn();
const asyncJobFindOne = jest.fn();
const asyncJobUpdate = jest.fn();
const asyncJobItemFindAll = jest.fn();
const asyncJobItemFindByPk = jest.fn();
const asyncJobItemUpdate = jest.fn();
const asyncJobItemCount = jest.fn();
const asyncJobEventCreate = jest.fn();
const sequelizeQuery = jest.fn();
const sequelizeTransaction = jest.fn();
const processItem = jest.fn();

jest.unstable_mockModule('../logger.js', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: {
    query: sequelizeQuery,
    transaction: sequelizeTransaction,
    literal: (value) => ({ literal: value }),
  },
}));

jest.unstable_mockModule('../src/config/metrics.js', () => ({
  __esModule: true,
  withJobMetrics: async (_name, fn) => fn(),
}));

jest.unstable_mockModule('../src/utils/redisLock.js', () => ({
  __esModule: true,
  buildJobLockKey: (name) => `job:${name}`,
  withRedisLock: async (_key, _ttl, fn) => fn(),
}));

jest.unstable_mockModule('../src/services/asyncJobRegistry.js', () => ({
  __esModule: true,
  getAsyncJobHandler: () => ({
    processItem,
  }),
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  AsyncJob: {
    findByPk: asyncJobFindByPk,
    update: asyncJobUpdate,
    findOne: asyncJobFindOne,
    create: jest.fn(),
  },
  AsyncJobItem: {
    findAll: asyncJobItemFindAll,
    findByPk: asyncJobItemFindByPk,
    update: asyncJobItemUpdate,
    bulkCreate: jest.fn(),
    count: asyncJobItemCount,
  },
  AsyncJobEvent: {
    create: asyncJobEventCreate,
  },
}));

const { startAsyncJobWorker } =
  await import('../src/services/asyncJobService.js');
const { retryFailedAsyncJob } =
  await import('../src/services/asyncJobService.js');

function makeJob(status = 'RUNNING') {
  return {
    id: 'job-1',
    job_type: 'REFEREE_CLOSING_DOCUMENTS',
    operation: 'CREATE_DRAFTS',
    queue: 'documents',
    scope_type: 'TOURNAMENT',
    scope_id: 'tour-1',
    status,
    dedupe_key: 'dedupe-1',
    total_count: 1,
    processed_count: 1,
    success_count: 0,
    skipped_count: 0,
    failure_count: 1,
    requested_by_user_id: 'actor-1',
    created_by: 'actor-1',
    update: jest.fn(async function update(values) {
      Object.assign(this, values);
      return this;
    }),
  };
}

function makeItem(status = 'QUEUED') {
  return {
    id: 'item-1',
    job_id: 'job-1',
    status,
    attempts: 0,
    max_attempts: 3,
    target_id: 'target-1',
    target_ref_json: {},
    update: jest.fn(async function update(values) {
      Object.assign(this, values);
      return this;
    }),
  };
}

async function waitFor(assertion, timeoutMs = 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  assertion();
}

beforeEach(() => {
  asyncJobFindByPk.mockReset();
  asyncJobFindOne.mockReset();
  asyncJobUpdate.mockReset();
  asyncJobItemFindAll.mockReset();
  asyncJobItemFindByPk.mockReset();
  asyncJobItemUpdate.mockReset();
  asyncJobItemCount.mockReset();
  asyncJobEventCreate.mockReset();
  sequelizeQuery.mockReset();
  sequelizeTransaction.mockReset();
  processItem.mockReset();

  sequelizeTransaction.mockImplementation(async (callback) => callback({}));
  asyncJobUpdate.mockResolvedValue([1]);
  asyncJobItemUpdate.mockResolvedValue([0]);
  asyncJobItemCount.mockResolvedValue(0);
  asyncJobEventCreate.mockResolvedValue({});
});

test('retry returns active duplicate job instead of violating dedupe uniqueness', async () => {
  const failedJob = makeJob('PARTIAL_FAILED');
  const activeDuplicate = {
    ...makeJob('QUEUED'),
    id: 'job-active',
    failure_count: 0,
    processed_count: 0,
  };
  asyncJobFindOne
    .mockResolvedValueOnce(failedJob)
    .mockResolvedValueOnce(activeDuplicate);

  const result = await retryFailedAsyncJob('job-1', 'actor-1');

  expect(result).toEqual(
    expect.objectContaining({
      job_id: 'job-active',
      status: 'QUEUED',
    })
  );
  expect(sequelizeTransaction).not.toHaveBeenCalled();
  expect(asyncJobItemUpdate).not.toHaveBeenCalled();
  expect(failedJob.update).not.toHaveBeenCalled();
});

test('worker does not overwrite in-flight canceled item with success', async () => {
  let canceled = false;
  const runningJob = makeJob('RUNNING');
  const canceledJob = makeJob('CANCELED');
  const queuedItem = makeItem('QUEUED');
  const canceledItem = makeItem('CANCELED');

  sequelizeQuery.mockResolvedValueOnce([{ id: 'job-1' }]).mockResolvedValue([]);
  asyncJobFindByPk.mockImplementation(async () =>
    canceled ? canceledJob : runningJob
  );
  asyncJobItemFindByPk.mockImplementation(async () =>
    canceled ? canceledItem : queuedItem
  );
  asyncJobItemFindAll.mockImplementation(async (options = {}) => {
    if (options.attributes?.includes('status')) return [canceledItem];
    return [queuedItem];
  });
  processItem.mockImplementation(async () => {
    canceled = true;
    return { result_json: { ok: true } };
  });

  const stop = startAsyncJobWorker({
    lockOwner: 'worker-1',
    lockTtlMs: 30000,
    pollIntervalMs: 60000,
  });
  await waitFor(() => expect(processItem).toHaveBeenCalledTimes(1));
  await stop();

  expect(queuedItem.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'RUNNING', locked_by: 'worker-1' })
  );
  expect(queuedItem.update).not.toHaveBeenCalledWith(
    expect.objectContaining({ status: 'SUCCESS' })
  );
  expect(canceledItem.update).not.toHaveBeenCalled();
  expect(asyncJobUpdate).not.toHaveBeenCalledWith(
    expect.objectContaining({ status: 'COMPLETED' }),
    expect.any(Object)
  );
});
