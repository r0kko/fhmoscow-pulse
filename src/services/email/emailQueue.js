import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';

import logger from '../../../logger.js';
import { createRedisClient } from '../../config/redis.js';
import {
  incEmailQueued,
  setEmailQueueDepthBucket,
  incEmailQueueRetry,
  incEmailQueueFailure,
} from '../../config/metrics.js';

import { deliverEmail, isEmailConfigured } from './emailTransport.js';

const STREAM_KEY = process.env.EMAIL_QUEUE_STREAM || 'mail:stream:v1';
const GROUP_NAME = process.env.EMAIL_QUEUE_GROUP || 'mailers';
const SCHEDULE_KEY =
  process.env.EMAIL_QUEUE_SCHEDULE || `${STREAM_KEY}:scheduled`;
const DLQ_KEY = process.env.EMAIL_QUEUE_DLQ || `${STREAM_KEY}:dlq`;
const MAX_STREAM_LENGTH = Number(
  process.env.EMAIL_QUEUE_MAX_STREAM_LENGTH || 10_000
);
const VISIBILITY_TIMEOUT_MS = Number(
  process.env.EMAIL_QUEUE_VISIBILITY_TIMEOUT_MS || 180_000
);
const BASE_RETRY_DELAY_MS = Number(
  process.env.EMAIL_QUEUE_RETRY_BASE_MS || 15_000
);
const MAX_RETRY_DELAY_MS = Number(
  process.env.EMAIL_QUEUE_RETRY_MAX_MS || 5 * 60_000
);
const MAX_ATTEMPTS = Number(process.env.EMAIL_QUEUE_MAX_ATTEMPTS || 5);
const DEFAULT_CONCURRENCY = Number(process.env.EMAIL_QUEUE_CONCURRENCY || 3);
const BATCH_SIZE = Number(process.env.EMAIL_QUEUE_BATCH_SIZE || 10);
const BLOCK_MS = Number(process.env.EMAIL_QUEUE_BLOCK_MS || 5_000);
const METRICS_INTERVAL_MS = Number(
  process.env.EMAIL_QUEUE_METRICS_INTERVAL_MS || 15_000
);
const SCHEDULE_DRAIN_LIMIT = Number(
  process.env.EMAIL_QUEUE_SCHEDULE_DRAIN_LIMIT || 100
);
const DEDUPE_ENABLED = String(process.env.EMAIL_QUEUE_DEDUPE_ENABLED ?? 'true')
  .toLowerCase()
  .match(/^(1|true|yes|on)$/);
const DEDUPE_KEY_PREFIX =
  process.env.EMAIL_QUEUE_DEDUPE_KEY || `${STREAM_KEY}:dedupe`;
const DEDUPE_TTL_MS = Number(
  process.env.EMAIL_QUEUE_DEDUPE_TTL_MS || 6 * 60 * 60 * 1000
);
const DEDUPE_GRACE_MS = Number(
  process.env.EMAIL_QUEUE_DEDUPE_GRACE_MS || 15 * 60 * 1000
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let producerClient;
let consumerClient;
let schedulerClient;
let initialized = false;
let running = false;
let consumerName = `${os.hostname?.() || 'worker'}:${process.pid}`;
let loops = [];
let metricsInterval;

function encode(job) {
  return JSON.stringify(job);
}

function decode(raw) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    logger.error('Email queue payload parsing failed', {
      error: err?.message || String(err),
      raw,
    });
    return null;
  }
}

function computeBackoff(attempt) {
  const safeAttempt = Number(attempt || 1);
  const delay = BASE_RETRY_DELAY_MS * 2 ** (safeAttempt - 1);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

async function ensureInitialized() {
  if (initialized) return;
  producerClient = createRedisClient();
  consumerClient = createRedisClient();
  schedulerClient = createRedisClient();
  await Promise.all([
    producerClient.connect(),
    consumerClient.connect(),
    schedulerClient.connect(),
  ]);
  await ensureGroup();
  initialized = true;
}

async function ensureGroup() {
  try {
    await consumerClient.xGroupCreate(STREAM_KEY, GROUP_NAME, '0', {
      MKSTREAM: true,
    });
  } catch (err) {
    const message = err?.message || '';
    if (!message.includes('BUSYGROUP')) {
      throw err;
    }
  }
}

function buildJob(payload, options = {}) {
  const now = Date.now();
  const purpose = payload.purpose || options.purpose || 'generic';
  const dedupeSource =
    payload.dedupeKey || options.dedupeKey || payload.metadata?.dedupeKey;
  const dedupeKey = normalizeDedupeKey(dedupeSource, payload, purpose);
  const job = {
    id: payload.id || options.id || dedupeKey || randomUUID(),
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    headers: payload.headers,
    cc: payload.cc,
    bcc: payload.bcc,
    purpose,
    metadata: payload.metadata || options.metadata || {},
    locale: payload.locale || options.locale,
    attempt: Number(payload.attempt || 0),
    maxAttempts: Number(
      options.maxAttempts || payload.maxAttempts || MAX_ATTEMPTS
    ),
    createdAt: payload.createdAt || now,
    queuedAt: now,
    dedupeKey,
  };
  const delayMs = Number(options.delayMs || payload.delayMs || 0);
  if (delayMs > 0) {
    job.availableAfter = now + delayMs;
    job.delayMs = delayMs;
  }
  const dedupeTtlMs = Number(
    options.dedupeTtlMs || payload.dedupeTtlMs || DEDUPE_TTL_MS
  );
  job.dedupeTtlMs = Math.max(dedupeTtlMs, (job.delayMs || 0) + DEDUPE_GRACE_MS);
  return job;
}

function normalizeDedupeKey(input, payload, purpose) {
  if (!DEDUPE_ENABLED) return null;
  let source = input;
  if (!source) {
    const fallback = {
      purpose,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      metadata: payload.metadata,
    };
    try {
      source = JSON.stringify(fallback);
    } catch (_err) {
      source = `${purpose}|${payload.to}|${payload.subject || ''}`;
    }
  }
  const normalized = String(source || '').trim();
  if (!normalized) return null;
  return createHash('sha256').update(normalized).digest('hex');
}

function dedupeRedisKey(key) {
  if (!key) return null;
  return `${DEDUPE_KEY_PREFIX}:${key}`;
}

function dedupeTtlForJob(job) {
  const base = Number(job?.dedupeTtlMs || DEDUPE_TTL_MS);
  const futureDelay = Number(job?.availableAfter || 0) - Date.now();
  const pendingDelay = Number(job?.delayMs || 0);
  const required = Math.max(
    base,
    futureDelay > 0 ? futureDelay + DEDUPE_GRACE_MS : 0,
    pendingDelay + DEDUPE_GRACE_MS
  );
  return Math.max(required, Math.max(DEDUPE_GRACE_MS, 1000));
}

async function acquireDedupeLock(job) {
  if (!DEDUPE_ENABLED) return { acquired: true };
  const redisKey = dedupeRedisKey(job?.dedupeKey);
  if (!redisKey) return { acquired: true };
  const ttl = dedupeTtlForJob(job);
  const result = await producerClient.set(redisKey, job.id, {
    NX: true,
    PX: ttl,
  });
  if (result === null) {
    const existingJobId = await producerClient.get(redisKey);
    return { acquired: false, existingJobId };
  }
  return { acquired: true, ttl };
}

async function refreshDedupeLock(job) {
  if (!DEDUPE_ENABLED) return;
  const redisKey = dedupeRedisKey(job?.dedupeKey);
  if (!redisKey) return;
  const ttl = dedupeTtlForJob(job);
  if (ttl > 0) {
    await producerClient.pExpire(redisKey, ttl).catch((err) => {
      logger.debug('Email dedupe TTL refresh failed', {
        error: err?.message || String(err),
        jobId: job?.id,
      });
    });
  }
}

async function releaseDedupeLock(job) {
  if (!DEDUPE_ENABLED) return;
  const redisKey = dedupeRedisKey(job?.dedupeKey);
  if (!redisKey) return;
  try {
    await producerClient.del(redisKey);
  } catch (err) {
    logger.debug('Email dedupe lock release failed', {
      error: err?.message || String(err),
      jobId: job?.id,
    });
  }
}

async function pushToStream(job) {
  const payload = encode(job);
  if (MAX_STREAM_LENGTH > 0) {
    await producerClient.xAdd(
      STREAM_KEY,
      '*',
      { payload },
      {
        TRIM: {
          strategy: 'MAXLEN',
          strategyModifier: '~',
          threshold: MAX_STREAM_LENGTH,
        },
      }
    );
  } else {
    await producerClient.xAdd(STREAM_KEY, '*', { payload });
  }
  await refreshDedupeLock(job);
}

async function scheduleJob(job) {
  await schedulerClient.zAdd(SCHEDULE_KEY, {
    score: job.availableAfter,
    value: encode(job),
  });
  await refreshDedupeLock(job);
}

async function promoteScheduled(limit = SCHEDULE_DRAIN_LIMIT) {
  const now = Date.now();
  const due = await schedulerClient.zRangeByScore(SCHEDULE_KEY, 0, now, {
    LIMIT: {
      offset: 0,
      count: limit,
    },
  });
  if (!due.length) return;
  const multi = schedulerClient.multi();
  for (const entry of due) {
    multi.zRem(SCHEDULE_KEY, entry);
    if (MAX_STREAM_LENGTH > 0) {
      multi.xAdd(
        STREAM_KEY,
        '*',
        { payload: entry },
        {
          TRIM: {
            strategy: 'MAXLEN',
            strategyModifier: '~',
            threshold: MAX_STREAM_LENGTH,
          },
        }
      );
    } else {
      multi.xAdd(STREAM_KEY, '*', { payload: entry });
    }
  }
  await multi.exec();
}

async function emitQueueMetrics() {
  if (!initialized) return;
  try {
    const [ready, scheduled, dead] = await Promise.all([
      producerClient.xLen(STREAM_KEY),
      schedulerClient.zCard(SCHEDULE_KEY),
      producerClient.xLen(DLQ_KEY),
    ]);
    setEmailQueueDepthBucket('ready', Number(ready));
    setEmailQueueDepthBucket('scheduled', Number(scheduled));
    setEmailQueueDepthBucket('dead_letter', Number(dead));
  } catch (err) {
    logger.debug('Email queue metrics collection failed', {
      error: err?.message || String(err),
    });
  }
}

async function handleSuccess(entryId, job) {
  await consumerClient.xAck(STREAM_KEY, GROUP_NAME, entryId);
  await releaseDedupeLock(job);
  logger.debug?.('Email job acknowledged', {
    jobId: job.id,
    purpose: job.purpose,
  });
}

async function moveToDlq(entryId, job, err) {
  job.failedAt = Date.now();
  job.lastError = {
    message: err?.message || err?.cause?.message || String(err),
    stack: err?.stack,
  };
  await consumerClient.xAck(STREAM_KEY, GROUP_NAME, entryId);
  await producerClient.xAdd(DLQ_KEY, '*', { payload: encode(job) });
  incEmailQueueFailure(job.purpose || 'generic');
  await releaseDedupeLock(job);
  logger.error('Email job moved to DLQ', {
    jobId: job.id,
    purpose: job.purpose,
    attempts: job.attempt,
    error: job.lastError?.message,
  });
}

async function handleFailure(entryId, job, err) {
  job.attempt = Number(job.attempt || 0) + 1;
  if (job.attempt >= Number(job.maxAttempts || MAX_ATTEMPTS)) {
    await moveToDlq(entryId, job, err);
    return;
  }
  job.lastError = {
    message: err?.message || err?.cause?.message || String(err),
    stack: err?.stack,
    at: Date.now(),
  };
  const delayMs = computeBackoff(job.attempt);
  job.availableAfter = Date.now() + delayMs;
  job.delayMs = delayMs;
  await consumerClient.xAck(STREAM_KEY, GROUP_NAME, entryId);
  await scheduleJob(job);
  incEmailQueueRetry(job.purpose || 'generic');
  logger.warn('Email job retry scheduled', {
    jobId: job.id,
    purpose: job.purpose,
    attempt: job.attempt,
    delay_ms: delayMs,
  });
}

async function processRecord(record) {
  const entryId = record?.id;
  const raw = record?.message?.payload;
  if (!entryId || !raw) {
    if (entryId) {
      await consumerClient.xAck(STREAM_KEY, GROUP_NAME, entryId);
    }
    return;
  }
  const job = decode(raw);
  if (!job) {
    await consumerClient.xAck(STREAM_KEY, GROUP_NAME, entryId);
    return;
  }
  if (job.availableAfter && job.availableAfter > Date.now()) {
    await consumerClient.xAck(STREAM_KEY, GROUP_NAME, entryId);
    await scheduleJob(job);
    return;
  }
  try {
    await deliverEmail(job);
    await handleSuccess(entryId, job);
  } catch (err) {
    await handleFailure(entryId, job, err);
  }
}

async function recoverPending() {
  let cursor = '0-0';
  while (running) {
    const result = await consumerClient.xAutoClaim(
      STREAM_KEY,
      GROUP_NAME,
      consumerName,
      VISIBILITY_TIMEOUT_MS,
      cursor,
      { COUNT: BATCH_SIZE }
    );
    const nextCursor = result?.nextId || result?.[0] || '0-0';
    const messages = result?.messages || result?.[1] || [];
    if (!messages.length) {
      break;
    }
    for (const record of messages) {
      await processRecord(record);
    }
    if (nextCursor === '0-0') {
      break;
    }
    cursor = nextCursor;
  }
}

async function workerLoop(slot) {
  while (running) {
    try {
      await promoteScheduled();
      const responses = await consumerClient.xReadGroup(
        GROUP_NAME,
        consumerName,
        [{ key: STREAM_KEY, id: '>' }],
        { COUNT: BATCH_SIZE, BLOCK: BLOCK_MS }
      );
      if (!responses) {
        await recoverPending();
        continue;
      }
      for (const stream of responses) {
        for (const record of stream?.messages || []) {
          await processRecord(record);
        }
      }
    } catch (err) {
      const message = err?.message || String(err);
      if (message.includes('READONLY')) {
        await wait(1000);
        continue;
      }
      if (message.includes('NOGROUP')) {
        await ensureGroup();
        continue;
      }
      if (message.includes('Connection is closed')) {
        if (!running) break;
      }
      logger.error('Email worker loop error', { error: message, slot });
      await wait(1000);
    }
  }
}

export async function enqueueEmail(payload, options = {}) {
  const purpose = payload.purpose || options.purpose || 'generic';
  if (!isEmailConfigured) {
    logger.warn('Email not configured');
    incEmailQueued('skipped', purpose);
    return { accepted: false, reason: 'not_configured' };
  }
  try {
    await ensureInitialized();
  } catch (err) {
    logger.error('Email queue unavailable, falling back to direct delivery', {
      error: err?.message || String(err),
    });
    try {
      await deliverEmail({ ...payload, purpose });
      incEmailQueued('fallback', purpose);
      return { accepted: false, delivered: true, fallback: 'direct' };
    } catch (directErr) {
      incEmailQueued('failed', purpose);
      logger.error('Email fallback delivery failed', {
        error: directErr?.message || String(directErr),
        to: payload?.to,
        purpose,
      });
      return { accepted: false, delivered: false, fallback: 'direct' };
    }
  }
  const job = buildJob(payload, { ...options, purpose });
  const dedupe = await acquireDedupeLock(job);
  if (!dedupe.acquired) {
    incEmailQueued('duplicate', purpose);
    logger.info('Email job deduplicated', {
      jobId: job.id,
      purpose: job.purpose,
      to: job.to,
      dedupe_key: job.dedupeKey,
      existingJobId: dedupe.existingJobId,
    });
    return {
      accepted: false,
      jobId: dedupe.existingJobId || job.id,
      reason: 'duplicate',
    };
  }
  if (job.availableAfter) {
    await scheduleJob(job);
    incEmailQueued('scheduled', purpose);
  } else {
    await pushToStream(job);
    incEmailQueued('queued', purpose);
  }
  logger.info('Email job enqueued', {
    jobId: job.id,
    purpose: job.purpose,
    to: job.to,
    delay_ms: job.delayMs || 0,
    dedupe_key: job.dedupeKey,
  });
  await emitQueueMetrics();
  return {
    accepted: true,
    jobId: job.id,
    scheduledFor: job.availableAfter ? new Date(job.availableAfter) : null,
  };
}

export async function startEmailWorker(options = {}) {
  if (!isEmailConfigured) {
    logger.warn('Email worker disabled because SMTP is not configured');
    return () => Promise.resolve();
  }
  await ensureInitialized();
  if (running) {
    return stopEmailWorker;
  }
  running = true;
  consumerName = options.consumerName || consumerName;
  const concurrency = Number(options.concurrency || DEFAULT_CONCURRENCY);
  for (let i = 0; i < concurrency; i += 1) {
    loops.push(workerLoop(i));
  }
  await emitQueueMetrics();
  metricsInterval = setInterval(() => {
    emitQueueMetrics().catch((err) => {
      logger.debug('Email queue metrics loop error', {
        error: err?.message || String(err),
      });
    });
  }, METRICS_INTERVAL_MS);
  if (metricsInterval.unref) metricsInterval.unref();
  return stopEmailWorker;
}

export async function stopEmailWorker() {
  if (!running) return;
  running = false;
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  try {
    await Promise.allSettled(loops);
  } catch (_err) {
    /* ignore */
  }
  loops = [];
  try {
    await Promise.all([
      consumerClient?.quit?.(),
      schedulerClient?.quit?.(),
      producerClient?.quit?.(),
    ]);
  } catch (err) {
    logger.warn('Error shutting down email queue clients', {
      error: err?.message || String(err),
    });
  } finally {
    initialized = false;
    producerClient = undefined;
    consumerClient = undefined;
    schedulerClient = undefined;
  }
}

export function getEmailQueueStats() {
  return {
    streamKey: STREAM_KEY,
    group: GROUP_NAME,
    scheduleKey: SCHEDULE_KEY,
    dlqKey: DLQ_KEY,
    initialized,
    running,
    consumerName,
  };
}

function resetStateForTests() {
  loops = [];
  initialized = false;
  running = false;
  metricsInterval = undefined;
  producerClient = undefined;
  consumerClient = undefined;
  schedulerClient = undefined;
  consumerName = `${os.hostname?.() || 'worker'}:${process.pid}`;
}

function setClientsForTests({ producer, consumer, scheduler } = {}) {
  if (producer !== undefined) producerClient = producer;
  if (consumer !== undefined) consumerClient = consumer;
  if (scheduler !== undefined) schedulerClient = scheduler;
}

export const __testables = {
  encode,
  decode,
  computeBackoff,
  buildJob,
  normalizeDedupeKey,
  dedupeRedisKey,
  dedupeTtlForJob,
  wait,
  acquireDedupeLock,
  refreshDedupeLock,
  releaseDedupeLock,
  handleSuccess,
  handleFailure,
  processRecord,
  promoteScheduled,
  emitQueueMetrics,
  recoverPending,
  workerLoop,
  resetStateForTests,
  setClientsForTests,
  setInitializedForTests(value = false) {
    initialized = Boolean(value);
  },
  setRunningForTests(value = false) {
    running = Boolean(value);
  },
};
