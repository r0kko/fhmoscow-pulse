import cron from 'node-cron';

import teamService from '../services/teamService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

let running = false;

export async function runTeamSync() {
  if (running) return;
  await withRedisLock(buildJobLockKey('teamSync'), 30 * 60_000, async () => {
    running = true;
    await withJobMetrics('teamSync', async () => {
      try {
        const { mode, cursor, outcome } = await runWithSyncState(
          'teamSync',
          async ({ mode, since }) => {
            const stats = await teamService.syncExternal({ mode, since });
            return {
              cursor: stats.cursor,
              stats,
              fullSync: stats.fullSync === true,
            };
          }
        );
        const stats = outcome?.stats || { upserts: 0, softDeletedTotal: 0 };
        logger.info(
          'Team sync completed (mode=%s, cursor=%s): upserted=%d, softDeleted=%d',
          mode,
          cursor ? new Date(cursor).toISOString() : 'n/a',
          stats.upserts,
          stats.softDeletedTotal
        );
      } catch (err) {
        logger.error('Team sync failed: %s', err.stack || err);
        throw err;
      } finally {
        running = false;
      }
    });
  });
}

export default function startTeamSyncCron() {
  // Fixed schedule: every 6 hours at minute 20 (after clubs and grounds)
  const schedule = '20 */6 * * *';
  cron.schedule(schedule, runTeamSync, { timezone: 'Europe/Moscow' });
}
