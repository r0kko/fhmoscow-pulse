import SyncState from '../models/syncState.js';

const DEFAULT_FULL_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isFinite(value.getTime()) ? value : null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function sanitizeStats(stats, depth = 0) {
  if (stats == null) return stats ?? null;
  if (depth > 4) return null;
  if (Array.isArray(stats)) {
    return stats.slice(0, 100).map((item) => sanitizeStats(item, depth + 1));
  }
  if (stats instanceof Date) return stats.toISOString();
  if (typeof stats !== 'object') {
    if (typeof stats === 'number' && !Number.isFinite(stats)) return null;
    return stats;
  }
  const result = {};
  for (const [key, value] of Object.entries(stats)) {
    result[key] = sanitizeStats(value, depth + 1);
  }
  return result;
}

function buildMeta(previousMeta, outcome, startedAt, finishedAt) {
  const base =
    previousMeta && typeof previousMeta === 'object' ? { ...previousMeta } : {};
  if (outcome?.stats !== undefined) {
    base.last_stats = sanitizeStats(outcome.stats);
  }
  if (outcome?.note) base.note = String(outcome.note);
  if (outcome?.meta && typeof outcome.meta === 'object') {
    base.extra = sanitizeStats(outcome.meta);
  } else if (outcome?.meta === null) {
    base.extra = null;
  }
  base.last_started_at = startedAt?.toISOString?.() || null;
  base.last_finished_at = finishedAt?.toISOString?.() || null;
  if (outcome?.durationMs != null)
    base.last_duration_ms = Number(outcome.durationMs);
  if (outcome?.deltaCount != null)
    base.last_delta_count = Number(outcome.deltaCount);
  base.last_outcome_status = outcome?.status || 'ok';
  return base;
}

export function normalizeSyncState(row) {
  if (!row) return null;
  return {
    job: row.job,
    lastCursor: row.last_cursor ? new Date(row.last_cursor) : null,
    lastMode: row.last_mode || null,
    lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
    lastFullSyncAt: row.last_full_sync_at
      ? new Date(row.last_full_sync_at)
      : null,
    meta: row.meta || null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

export async function getSyncState(job) {
  if (!job) return null;
  const row = await SyncState.findOne({ where: { job } });
  return normalizeSyncState(row);
}

export async function getSyncStates(jobs = []) {
  if (!jobs?.length) return {};
  const rows = await SyncState.findAll({ where: { job: jobs } });
  const map = {};
  for (const row of rows) map[row.job] = normalizeSyncState(row);
  return map;
}

export async function runWithSyncState(
  job,
  runner,
  { forceMode = null, fullIntervalMs = DEFAULT_FULL_INTERVAL_MS } = {}
) {
  if (!job) throw new Error('job is required');
  if (typeof runner !== 'function')
    throw new Error('runner must be a function');

  const startedAt = new Date();
  const state = await SyncState.findOne({ where: { job } });

  const lastFull = toDate(state?.last_full_sync_at);
  const lastCursor = toDate(state?.last_cursor);

  let mode = forceMode || 'incremental';
  if (!forceMode) {
    if (!lastCursor) {
      mode = 'full';
    } else if (!lastFull) {
      mode = 'full';
    } else if (fullIntervalMs && Number.isFinite(fullIntervalMs)) {
      const due = lastFull.getTime() + fullIntervalMs;
      if (Date.now() >= due) mode = 'full';
    }
  }
  const since = mode === 'incremental' ? lastCursor : null;

  const context = {
    mode,
    since,
    state: normalizeSyncState(state),
  };

  const outcome = (await runner(context)) || {};
  const completedAt = new Date();

  const nextCursor =
    toDate(outcome.cursor) || (mode === 'incremental' ? lastCursor : null);
  const payload = {
    job,
    last_mode: mode,
    last_run_at: completedAt,
    last_cursor: nextCursor,
    meta: buildMeta(state?.meta, outcome, startedAt, completedAt),
  };
  if (mode === 'full' || outcome.fullSync === true) {
    payload.last_full_sync_at = completedAt;
  } else if (state?.last_full_sync_at) {
    payload.last_full_sync_at = state.last_full_sync_at;
  }

  await SyncState.upsert(payload, { returning: false });

  return {
    ...context,
    cursor: nextCursor,
    outcome,
  };
}

export default {
  getSyncState,
  getSyncStates,
  runWithSyncState,
  normalizeSyncState,
};
