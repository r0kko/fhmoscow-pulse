import { createHash, randomUUID } from 'crypto';

import { Op, QueryTypes } from 'sequelize';

import logger from '../../logger.js';
import sequelize from '../config/database.js';
import { withJobMetrics } from '../config/metrics.js';
import ServiceError from '../errors/ServiceError.js';
import { AsyncJob, AsyncJobEvent, AsyncJobItem } from '../models/index.js';
import { buildJobLockKey, withRedisLock } from '../utils/redisLock.js';

import { getAsyncJobHandler } from './asyncJobRegistry.js';

const ACTIVE_STATUSES = ['QUEUED', 'RUNNING'];
const TERMINAL_STATUSES = ['COMPLETED', 'PARTIAL_FAILED', 'FAILED', 'CANCELED'];
const DEFAULT_ITEM_MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1000;
const RETRY_CAP_MS = 30_000;
const DEFAULT_LOCK_TTL_MS = 30 * 60_000;
const DEFAULT_POLL_INTERVAL_MS = 2500;

function normalizeString(value) {
  return String(value ?? '').trim();
}

function normalizeJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  return fallback;
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map((item) => stableJson(item));
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableJson(value[key]);
        return acc;
      }, {});
  }
  return value;
}

export function buildAsyncJobDedupeKey(payload) {
  return createHash('sha256')
    .update(JSON.stringify(stableJson(payload)))
    .digest('hex');
}

function errorCode(error, fallback = 'async_job_failed') {
  return normalizeString(error?.code || error?.message || fallback) || fallback;
}

function retryDelayMs(attempt) {
  return Math.min(
    RETRY_BASE_MS * 2 ** Math.max(0, Number(attempt || 1) - 1),
    RETRY_CAP_MS
  );
}

function progressPercent(job) {
  const total = Number(job?.total_count || 0);
  const processed = Number(job?.processed_count || 0);
  return total ? Math.min(100, Math.round((processed / total) * 100)) : 0;
}

export function serializeAsyncJob(job) {
  if (!job) return null;
  const plain = typeof job.get === 'function' ? job.get({ plain: true }) : job;
  return {
    job_id: plain.id,
    job_type: plain.job_type,
    operation: plain.operation,
    queue: plain.queue,
    scope_type: plain.scope_type,
    scope_id: plain.scope_id || null,
    status: plain.status,
    total_count: Number(plain.total_count || 0),
    processed_count: Number(plain.processed_count || 0),
    success_count: Number(plain.success_count || 0),
    skipped_count: Number(plain.skipped_count || 0),
    failure_count: Number(plain.failure_count || 0),
    progress_percent: progressPercent(plain),
    payload: plain.payload_json || {},
    selection: plain.selection_json || {},
    result: plain.result_json || {},
    error_code: plain.error_code || null,
    error_message: plain.error_message || null,
    scheduled_at: plain.scheduled_at || null,
    started_at: plain.started_at || null,
    finished_at: plain.finished_at || null,
    poll_url: `/api/admin/async-jobs/${plain.id}`,
  };
}

export function serializeAsyncJobItem(item) {
  const plain =
    typeof item?.get === 'function' ? item.get({ plain: true }) : item;
  return {
    id: plain.id,
    job_id: plain.job_id,
    item_type: plain.item_type,
    target_type: plain.target_type || null,
    target_id: plain.target_id || null,
    target_ref: plain.target_ref_json || {},
    payload: plain.payload_json || {},
    result: plain.result_json || {},
    status: plain.status,
    attempts: Number(plain.attempts || 0),
    max_attempts: Number(plain.max_attempts || DEFAULT_ITEM_MAX_ATTEMPTS),
    next_attempt_at: plain.next_attempt_at || null,
    error_code: plain.error_code || null,
    error_message: plain.error_message || null,
    started_at: plain.started_at || null,
    finished_at: plain.finished_at || null,
  };
}

async function writeJobEvent({
  jobId,
  itemId = null,
  eventType,
  message = null,
  meta = {},
  actorId = null,
  transaction = null,
}) {
  if (!jobId || !eventType) return null;
  return AsyncJobEvent.create(
    {
      job_id: jobId,
      item_id: itemId,
      event_type: eventType,
      message,
      meta_json: normalizeJson(meta, {}),
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction }
  );
}

async function refreshJobCounters(jobId, transaction = null) {
  const rows = await AsyncJobItem.findAll({
    where: { job_id: jobId },
    attributes: ['status'],
    transaction,
  });
  const counts = rows.reduce(
    (acc, row) => {
      if (row.status === 'SUCCESS') acc.success_count += 1;
      if (row.status === 'SKIPPED') acc.skipped_count += 1;
      if (row.status === 'FAILED') acc.failure_count += 1;
      return acc;
    },
    { success_count: 0, skipped_count: 0, failure_count: 0 }
  );
  counts.processed_count =
    counts.success_count + counts.skipped_count + counts.failure_count;
  await AsyncJob.update(counts, { where: { id: jobId }, transaction });
  return { ...counts, total_count: rows.length };
}

export async function createAsyncJob({
  jobType,
  operation,
  queue = 'default',
  scopeType = 'SYSTEM',
  scopeId = null,
  payload = {},
  selection = {},
  result = {},
  items = [],
  dedupeKey = null,
  idempotencyKey = null,
  requestedByUserId = null,
  priority = 0,
  scheduledAt = null,
  expiresAt = null,
}) {
  const normalizedJobType = normalizeString(jobType).toUpperCase();
  const normalizedOperation = normalizeString(operation).toUpperCase();
  if (!normalizedJobType || !normalizedOperation) {
    throw new ServiceError('async_job_type_required', 400);
  }
  if (!Array.isArray(items)) {
    throw new ServiceError('async_job_items_invalid', 400);
  }

  if (dedupeKey) {
    const existing = await AsyncJob.findOne({
      where: {
        dedupe_key: dedupeKey,
        status: { [Op.in]: ACTIVE_STATUSES },
      },
      order: [['created_at', 'DESC']],
    });
    if (existing) return serializeAsyncJob(existing);
  }

  try {
    const job = await sequelize.transaction(async (transaction) => {
      const createdJob = await AsyncJob.create(
        {
          job_type: normalizedJobType,
          operation: normalizedOperation,
          queue: normalizeString(queue) || 'default',
          scope_type: normalizeString(scopeType).toUpperCase() || 'SYSTEM',
          scope_id: scopeId || null,
          status: 'QUEUED',
          priority: Number(priority || 0),
          payload_json: normalizeJson(payload, {}),
          selection_json: normalizeJson(selection, {}),
          result_json: normalizeJson(result, {}),
          dedupe_key: dedupeKey || null,
          idempotency_key: idempotencyKey || null,
          requested_by_user_id: requestedByUserId || null,
          total_count: items.length,
          scheduled_at: scheduledAt || new Date(),
          expires_at: expiresAt || null,
          created_by: requestedByUserId || null,
          updated_by: requestedByUserId || null,
        },
        { transaction }
      );
      if (items.length) {
        await AsyncJobItem.bulkCreate(
          items.map((item) => ({
            job_id: createdJob.id,
            item_type: normalizeString(item.item_type).toUpperCase(),
            target_type: item.target_type
              ? normalizeString(item.target_type).toUpperCase()
              : null,
            target_id: item.target_id || null,
            target_ref_json: normalizeJson(item.target_ref_json, {}),
            payload_json: normalizeJson(item.payload_json, {}),
            result_json: normalizeJson(item.result_json, {}),
            status: item.status || 'QUEUED',
            attempts: Number(item.attempts || 0),
            max_attempts: Number(
              item.max_attempts || DEFAULT_ITEM_MAX_ATTEMPTS
            ),
            next_attempt_at: item.next_attempt_at || null,
            created_by: requestedByUserId || null,
            updated_by: requestedByUserId || null,
          })),
          { transaction }
        );
      }
      await writeJobEvent({
        jobId: createdJob.id,
        eventType: 'JOB_CREATED',
        meta: {
          job_type: normalizedJobType,
          operation: normalizedOperation,
          queue,
          total_count: items.length,
        },
        actorId: requestedByUserId,
        transaction,
      });
      return createdJob;
    });
    return serializeAsyncJob(job);
  } catch (error) {
    if (dedupeKey && error?.parent?.code === '23505') {
      const existing = await AsyncJob.findOne({
        where: {
          dedupe_key: dedupeKey,
          status: { [Op.in]: ACTIVE_STATUSES },
        },
        order: [['created_at', 'DESC']],
      });
      if (existing) return serializeAsyncJob(existing);
    }
    throw error;
  }
}

function buildJobWhere(jobId, options = {}) {
  const where = { id: jobId };
  if (options.scopeType) {
    where.scope_type = normalizeString(options.scopeType).toUpperCase();
  }
  if (options.scopeId) where.scope_id = options.scopeId;
  return where;
}

export async function getAsyncJob(jobId, options = {}) {
  const job = await AsyncJob.findOne({ where: buildJobWhere(jobId, options) });
  if (!job) throw new ServiceError('async_job_not_found', 404);
  return serializeAsyncJob(job);
}

export async function listAsyncJobItems(jobId, filters = {}, options = {}) {
  const job = await AsyncJob.findOne({
    where: buildJobWhere(jobId, options),
    attributes: ['id'],
  });
  if (!job) throw new ServiceError('async_job_not_found', 404);
  const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(filters.limit || '20', 10) || 20)
  );
  const where = { job_id: jobId };
  const status = normalizeString(filters.status || '').toUpperCase();
  if (status) where.status = status;
  const result = await AsyncJobItem.findAndCountAll({
    where,
    order: [['created_at', 'ASC']],
    offset: (page - 1) * limit,
    limit,
  });
  return {
    items: result.rows.map(serializeAsyncJobItem),
    total: result.count,
    page,
    limit,
  };
}

export async function retryFailedAsyncJob(jobId, actorId, options = {}) {
  const job = await AsyncJob.findOne({ where: buildJobWhere(jobId, options) });
  if (!job) throw new ServiceError('async_job_not_found', 404);
  if (job.status === 'CANCELED') {
    throw new ServiceError('async_job_canceled', 409);
  }
  await sequelize.transaction(async (transaction) => {
    await AsyncJobItem.update(
      {
        status: 'QUEUED',
        attempts: 0,
        next_attempt_at: null,
        locked_by: null,
        locked_at: null,
        lock_expires_at: null,
        error_code: null,
        error_message: null,
        finished_at: null,
        updated_by: actorId || null,
      },
      { where: { job_id: job.id, status: 'FAILED' }, transaction }
    );
    await job.update(
      {
        status: 'QUEUED',
        finished_at: null,
        error_code: null,
        error_message: null,
        locked_by: null,
        locked_at: null,
        lock_expires_at: null,
        updated_by: actorId || null,
      },
      { transaction }
    );
    await refreshJobCounters(job.id, transaction);
    await writeJobEvent({
      jobId: job.id,
      eventType: 'JOB_RETRY_FAILED',
      actorId,
      transaction,
    });
  });
  return getAsyncJob(job.id, options);
}

export async function cancelAsyncJob(jobId, actorId, options = {}) {
  const job = await AsyncJob.findOne({ where: buildJobWhere(jobId, options) });
  if (!job) throw new ServiceError('async_job_not_found', 404);
  if (TERMINAL_STATUSES.includes(job.status)) return serializeAsyncJob(job);
  await sequelize.transaction(async (transaction) => {
    await AsyncJobItem.update(
      {
        status: 'CANCELED',
        locked_by: null,
        locked_at: null,
        lock_expires_at: null,
        finished_at: new Date(),
        updated_by: actorId || null,
      },
      {
        where: {
          job_id: job.id,
          status: { [Op.in]: ['QUEUED', 'RUNNING'] },
        },
        transaction,
      }
    );
    await job.update(
      {
        status: 'CANCELED',
        locked_by: null,
        locked_at: null,
        lock_expires_at: null,
        finished_at: new Date(),
        updated_by: actorId || null,
      },
      { transaction }
    );
    await writeJobEvent({
      jobId: job.id,
      eventType: 'JOB_CANCELED',
      actorId,
      transaction,
    });
  });
  return getAsyncJob(job.id, options);
}

async function recoverStuckJobs(lockOwner) {
  const now = new Date();
  await AsyncJobItem.update(
    {
      status: 'QUEUED',
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
    },
    {
      where: {
        status: 'RUNNING',
        lock_expires_at: { [Op.lt]: now },
      },
    }
  );
  const [count] = await AsyncJob.update(
    {
      status: 'QUEUED',
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
    },
    {
      where: {
        status: 'RUNNING',
        lock_expires_at: { [Op.lt]: now },
      },
    }
  );
  if (count) {
    logger.warn('Recovered stuck async jobs', { count, lockOwner });
  }
}

async function claimNextJob({ queues, lockOwner, lockTtlMs }) {
  return sequelize.transaction(async (transaction) => {
    const replacements = {
      now: new Date(),
      lockOwner,
      lockExpiresAt: new Date(Date.now() + lockTtlMs),
    };
    const queuePredicate =
      Array.isArray(queues) && queues.length ? 'AND queue IN (:queues)' : '';
    if (Array.isArray(queues) && queues.length) replacements.queues = queues;
    const rows = await sequelize.query(
      `
        SELECT id
        FROM async_jobs
        WHERE deleted_at IS NULL
          AND status = 'QUEUED'
          AND scheduled_at <= :now
          ${queuePredicate}
        ORDER BY priority DESC, scheduled_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `,
      {
        type: QueryTypes.SELECT,
        replacements,
        transaction,
      }
    );
    const row = rows[0];
    if (!row) return null;
    await AsyncJob.update(
      {
        status: 'RUNNING',
        locked_by: lockOwner,
        locked_at: replacements.now,
        lock_expires_at: replacements.lockExpiresAt,
        started_at: sequelize.literal('COALESCE(started_at, NOW())'),
        error_code: null,
        error_message: null,
      },
      { where: { id: row.id }, transaction }
    );
    await writeJobEvent({
      jobId: row.id,
      eventType: 'JOB_CLAIMED',
      meta: { lock_owner: lockOwner },
      transaction,
    });
    return AsyncJob.findByPk(row.id, { transaction });
  });
}

async function markItemFailure({ job, item, error, handler, actorId }) {
  const attempts = Number(item.attempts || 0);
  const maxAttempts = Number(item.max_attempts || DEFAULT_ITEM_MAX_ATTEMPTS);
  const code = errorCode(error, 'async_job_item_failed');
  const retryable =
    attempts < maxAttempts &&
    (typeof handler?.isRetryableError === 'function'
      ? handler.isRetryableError(error, { job, item })
      : true);
  await item.update({
    status: retryable ? 'QUEUED' : 'FAILED',
    next_attempt_at: retryable
      ? new Date(Date.now() + retryDelayMs(attempts))
      : null,
    locked_by: null,
    locked_at: null,
    lock_expires_at: null,
    error_code: code,
    error_message: normalizeString(error?.message || ''),
    finished_at: retryable ? null : new Date(),
    updated_by: actorId || null,
  });
  await writeJobEvent({
    jobId: job.id,
    itemId: item.id,
    eventType: retryable ? 'ITEM_RETRY_SCHEDULED' : 'ITEM_FAILED',
    message: normalizeString(error?.message || ''),
    meta: { error_code: code, attempts, max_attempts: maxAttempts },
    actorId,
  });
}

async function getCurrentRunningItemForOutcome({ jobId, itemId, lockOwner }) {
  const [latestJob, latestItem] = await Promise.all([
    AsyncJob.findByPk(jobId),
    AsyncJobItem.findByPk(itemId),
  ]);
  if (!latestJob || !latestItem) return null;
  if (TERMINAL_STATUSES.includes(latestJob.status)) return null;
  if (latestItem.status !== 'RUNNING') return null;
  if (latestItem.locked_by && latestItem.locked_by !== lockOwner) return null;
  return { job: latestJob, item: latestItem };
}

async function processJobItem({ job, item, handler, lockOwner, lockTtlMs }) {
  const actorId = job.requested_by_user_id || job.created_by || null;
  await item.update({
    status: 'RUNNING',
    attempts: Number(item.attempts || 0) + 1,
    started_at: item.started_at || new Date(),
    finished_at: null,
    locked_by: lockOwner,
    locked_at: new Date(),
    lock_expires_at: new Date(Date.now() + lockTtlMs),
    updated_by: actorId,
  });
  await writeJobEvent({
    jobId: job.id,
    itemId: item.id,
    eventType: 'ITEM_STARTED',
    actorId,
  });

  try {
    const result = await handler.processItem({ job, item });
    const current = await getCurrentRunningItemForOutcome({
      jobId: job.id,
      itemId: item.id,
      lockOwner,
    });
    if (!current) return;
    const status = result?.status === 'SKIPPED' ? 'SKIPPED' : 'SUCCESS';
    await current.item.update({
      status,
      target_id: result?.target_id || current.item.target_id || null,
      target_ref_json:
        result?.target_ref_json || current.item.target_ref_json || {},
      result_json: result?.result_json || result || {},
      next_attempt_at: null,
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      error_code: null,
      error_message: null,
      finished_at: new Date(),
      updated_by: actorId,
    });
    await writeJobEvent({
      jobId: job.id,
      itemId: item.id,
      eventType: status === 'SKIPPED' ? 'ITEM_SKIPPED' : 'ITEM_SUCCEEDED',
      meta: { result: result?.result_json || {} },
      actorId,
    });
  } catch (error) {
    const current = await getCurrentRunningItemForOutcome({
      jobId: job.id,
      itemId: item.id,
      lockOwner,
    });
    if (!current) return;
    await markItemFailure({
      job: current.job,
      item: current.item,
      error,
      handler,
      actorId,
    });
  } finally {
    await refreshJobCounters(job.id);
  }
}

async function finalizeJob(job, actorId) {
  const latestJob = await AsyncJob.findByPk(job.id);
  if (!latestJob || TERMINAL_STATUSES.includes(latestJob.status)) {
    return false;
  }
  const counters = await refreshJobCounters(job.id);
  const remaining = await AsyncJobItem.count({
    where: {
      job_id: job.id,
      status: { [Op.in]: ['QUEUED', 'RUNNING'] },
    },
  });
  if (remaining > 0) {
    const nextItem = await AsyncJobItem.findOne({
      where: {
        job_id: job.id,
        status: { [Op.in]: ['QUEUED', 'RUNNING'] },
        next_attempt_at: { [Op.ne]: null },
      },
      attributes: ['next_attempt_at'],
      order: [['next_attempt_at', 'ASC']],
    });
    const [updatedCount] = await AsyncJob.update(
      {
        status: 'QUEUED',
        ...counters,
        locked_by: null,
        locked_at: null,
        lock_expires_at: null,
        scheduled_at: nextItem?.next_attempt_at || new Date(Date.now() + 2500),
        updated_by: actorId || null,
      },
      {
        where: {
          id: job.id,
          status: { [Op.notIn]: TERMINAL_STATUSES },
        },
      }
    );
    if (!updatedCount) return false;
    return false;
  }
  const terminalStatus =
    counters.failure_count === 0
      ? 'COMPLETED'
      : counters.success_count + counters.skipped_count > 0
        ? 'PARTIAL_FAILED'
        : 'FAILED';
  const [updatedCount] = await AsyncJob.update(
    {
      status: terminalStatus,
      ...counters,
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      finished_at: new Date(),
      updated_by: actorId || null,
    },
    {
      where: {
        id: job.id,
        status: { [Op.notIn]: TERMINAL_STATUSES },
      },
    }
  );
  if (!updatedCount) return false;
  await writeJobEvent({
    jobId: job.id,
    eventType: 'JOB_FINISHED',
    meta: { status: terminalStatus, ...counters },
    actorId,
  });
  return true;
}

async function processClaimedJob(job, { lockOwner, lockTtlMs }) {
  const handler = getAsyncJobHandler(job.job_type, job.operation);
  const actorId = job.requested_by_user_id || job.created_by || null;
  if (!handler) {
    throw new ServiceError('async_job_handler_not_found', 500);
  }

  await withRedisLock(
    buildJobLockKey(`asyncJob:${job.id}`),
    lockTtlMs,
    async () => {
      const freshJob = await AsyncJob.findByPk(job.id);
      if (!freshJob || TERMINAL_STATUSES.includes(freshJob.status)) return;
      if (typeof handler.onJobStart === 'function') {
        await handler.onJobStart({ job: freshJob });
      }
      const dueItems = await AsyncJobItem.findAll({
        where: {
          job_id: freshJob.id,
          status: 'QUEUED',
          [Op.or]: [
            { next_attempt_at: null },
            { next_attempt_at: { [Op.lte]: new Date() } },
          ],
        },
        order: [['created_at', 'ASC']],
      });
      for (const item of dueItems) {
        const latestJob = await AsyncJob.findByPk(freshJob.id);
        if (!latestJob || latestJob.status === 'CANCELED') break;
        await processJobItem({
          job: latestJob,
          item,
          handler,
          lockOwner,
          lockTtlMs,
        });
      }
      const completed = await finalizeJob(freshJob, actorId);
      if (completed && typeof handler.onJobComplete === 'function') {
        await handler.onJobComplete({ job: await AsyncJob.findByPk(job.id) });
      }
    }
  );
}

export function startAsyncJobWorker(options = {}) {
  const lockOwner = options.lockOwner || `async-worker-${randomUUID()}`;
  const lockTtlMs = Number(options.lockTtlMs || DEFAULT_LOCK_TTL_MS);
  const pollIntervalMs = Number(
    options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS
  );
  const queues = Array.isArray(options.queues) ? options.queues : null;
  let stopped = false;
  let timer = null;
  let running = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      await recoverStuckJobs(lockOwner);
      let job = await claimNextJob({ queues, lockOwner, lockTtlMs });
      while (job && !stopped) {
        const start = Date.now();
        try {
          await withJobMetrics(
            `asyncJob.${job.job_type}.${job.operation}`,
            () => processClaimedJob(job, { lockOwner, lockTtlMs })
          );
        } catch (error) {
          logger.error('Async job failed', {
            job_id: job.id,
            job_type: job.job_type,
            operation: job.operation,
            queue: job.queue,
            scope_type: job.scope_type,
            scope_id: job.scope_id,
            code: errorCode(error),
            message: normalizeString(error?.message || ''),
            duration_ms: Date.now() - start,
          });
          await job.update({
            status: 'FAILED',
            error_code: errorCode(error),
            error_message: normalizeString(error?.message || ''),
            locked_by: null,
            locked_at: null,
            lock_expires_at: null,
            finished_at: new Date(),
          });
          await writeJobEvent({
            jobId: job.id,
            eventType: 'JOB_FAILED',
            message: normalizeString(error?.message || ''),
            meta: { error_code: errorCode(error) },
          });
        }
        job = await claimNextJob({ queues, lockOwner, lockTtlMs });
      }
    } catch (error) {
      logger.error('Async job worker tick failed', {
        lock_owner: lockOwner,
        code: errorCode(error),
        message: normalizeString(error?.message || ''),
      });
    } finally {
      running = false;
    }
  };

  timer = setInterval(() => {
    void tick();
  }, pollIntervalMs);
  if (timer.unref) timer.unref();
  void tick();

  return async () => {
    stopped = true;
    if (timer) clearInterval(timer);
    while (running) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };
}

export default {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  buildAsyncJobDedupeKey,
  serializeAsyncJob,
  serializeAsyncJobItem,
  createAsyncJob,
  getAsyncJob,
  listAsyncJobItems,
  retryFailedAsyncJob,
  cancelAsyncJob,
  startAsyncJobWorker,
};
