import cron from 'node-cron';

import clubService from '../services/clubService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

let running = false;

export async function runClubSync() {
  if (running) return;
  await withRedisLock(buildJobLockKey('clubSync'), 30 * 60_000, async () => {
    running = true;
    await withJobMetrics('clubSync', async () => {
      try {
        const { mode, cursor, outcome } = await runWithSyncState(
          'clubSync',
          async ({ mode, since }) => {
            const stats = await clubService.syncExternal({ mode, since });
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
          'Club sync completed (mode=%s, cursor=%s): upserted=%d, softDeleted=%d (archived=%d, missing=%d)',
          mode,
          cursor ? new Date(cursor).toISOString() : 'n/a',
          stats.upserts,
          stats.softDeletedTotal,
          stats.softDeletedArchived,
          stats.softDeletedMissing
        );
      } catch (err) {
        logger.error('Club sync failed: %s', err.stack || err);
        throw err;
      } finally {
        running = false;
      }
    });
  });
}

export default function startClubSyncCron() {
  // Fixed schedule: every 6 hours at minute 0
  const schedule = '0 */6 * * *';
  cron.schedule(schedule, runClubSync, { timezone: 'Europe/Moscow' });
}
