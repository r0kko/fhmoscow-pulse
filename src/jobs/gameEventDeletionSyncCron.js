import cron from 'node-cron';

import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import deletionService from '../services/gameEventDeletionSyncService.js';

export async function runGameEventDeletionSync() {
  await withRedisLock(
    buildJobLockKey('gameEventDeletionSync'),
    30 * 60_000, // 30 minutes
    async () => {
      await withJobMetrics('gameEventDeletionSync', async () => {
        try {
          const stats = await deletionService.reapOrphans();
          logger.info(
            'GameEvent deletion sync completed: scanned=%d, deleted=%d, batches=%d',
            stats.scanned,
            stats.deleted,
            stats.batches
          );
        } catch (err) {
          logger.error('GameEvent deletion sync failed: %s', err.stack || err);
          throw err;
        }
      });
    }
  );
}

let scheduled = false;
let task = null;

export default function startGameEventDeletionSyncCron() {
  if (scheduled) return;
  // Fixed schedule: daily at 02:30 MSK
  const schedule = '30 2 * * *';
  task = cron.schedule(schedule, runGameEventDeletionSync, {
    timezone: 'Europe/Moscow',
  });
  scheduled = true;
}

export function _getGameEventDeletionCronTask() {
  return task;
}
