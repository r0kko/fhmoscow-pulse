import cron from 'node-cron';

import groundService from '../services/groundService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

let running = false;

export async function runGroundSync() {
  if (running) return;
  await withRedisLock(buildJobLockKey('groundSync'), 30 * 60_000, async () => {
    running = true;
    await withJobMetrics('groundSync', async () => {
      try {
        const { mode, cursor, outcome } = await runWithSyncState(
          'groundSync',
          async ({ mode, since }) => {
            const stats = await groundService.syncExternal({ mode, since });
            return {
              cursor: stats.cursor,
              stats,
              fullSync: stats.fullSync === true,
            };
          }
        );
        const stats = outcome?.stats || {
          upserts: 0,
          softDeletedTotal: 0,
          softDeletedArchived: 0,
          softDeletedMissing: 0,
        };
        logger.info(
          'Ground sync completed (mode=%s, cursor=%s): upserted=%d, softDeleted=%d (archived=%d, missing=%d)',
          mode,
          cursor ? new Date(cursor).toISOString() : 'n/a',
          stats.upserts,
          stats.softDeletedTotal,
          stats.softDeletedArchived,
          stats.softDeletedMissing
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
