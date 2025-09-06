import cron from 'node-cron';

import groundService from '../services/groundService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';

let running = false;

export async function runGroundSync() {
  if (running) return;
  await withRedisLock(buildJobLockKey('groundSync'), 30 * 60_000, async () => {
    running = true;
    await withJobMetrics('groundSync', async () => {
      try {
        const result = await groundService.syncExternal();
        logger.info(
          'Ground sync completed: upserted=%d, softDeleted=%d (archived=%d, missing=%d)',
          result.upserts,
          result.softDeletedTotal,
          result.softDeletedArchived,
          result.softDeletedMissing
        );
      } catch (err) {
        logger.error('Ground sync failed: %s', err.stack || err);
        throw err;
      } finally {
        running = false;
      }
    });
  });
}

export default function startGroundSyncCron() {
  // Fixed schedule: every 6 hours at minute 10 (after clubs)
  const schedule = '10 */6 * * *';
  cron.schedule(schedule, runGroundSync, { timezone: 'Europe/Moscow' });
}
