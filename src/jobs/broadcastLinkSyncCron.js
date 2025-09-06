import cron from 'node-cron';

import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import logger from '../../logger.js';
import { reconcileWindow } from '../services/broadcastSyncService.js';

let running = false;
let scheduled = false;
let task = null;

export async function runBroadcastLinkSync() {
  if (running) return;
  await withRedisLock(
    buildJobLockKey('broadcastLinkSync'),
    10 * 60_000,
    async () => {
      running = true;
      await withJobMetrics('broadcastLinkSync', async () => {
        try {
          const daysAhead = Number(process.env.BROADCAST_SYNC_AHEAD_DAYS || 7);
          const daysBack = Number(process.env.BROADCAST_SYNC_BACK_DAYS || 3);
          const limit = Number(process.env.BROADCAST_SYNC_LIMIT || 500);
          const stats = await reconcileWindow({ daysAhead, daysBack, limit });
          logger.info(
            'BroadcastLink sync: processed=%d, updated=%d, deleted=%d',
            stats.processed,
            stats.updated,
            stats.deleted
          );
        } catch (err) {
          logger.error('BroadcastLink sync failed: %s', err.stack || err);
          throw err;
        } finally {
          running = false;
        }
      });
    }
  );
}

export default function startBroadcastLinkSyncCron() {
  if (scheduled) return;
  const schedule = process.env.BROADCAST_SYNC_CRON || '*/10 * * * *';
  task = cron.schedule(schedule, runBroadcastLinkSync, {
    timezone: 'Europe/Moscow',
  });
  scheduled = true;
}

export function _getBroadcastLinkSyncTask() {
  return task;
}

export function isBroadcastLinkSyncRunning() {
  return running;
}

export function stopBroadcastLinkSyncCron() {
  try {
    if (task) task.stop();
  } catch {
    /* noop */
  }
}

export function restartBroadcastLinkSyncCron() {
  stopBroadcastLinkSyncCron();
  scheduled = false;
  startBroadcastLinkSyncCron();
}

export function resetBroadcastLinkSyncState() {
  running = false;
}
