import cron from 'node-cron';

import teamService from '../services/teamService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';

let running = false;

export async function runTeamSync() {
  if (running) return;
  await withRedisLock(buildJobLockKey('teamSync'), 30 * 60_000, async () => {
    running = true;
    await withJobMetrics('teamSync', async () => {
      try {
        const stats = await teamService.syncExternal();
        logger.info(
          'Team sync completed: upserted=%d, softDeleted=%d',
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
  // Default: every 6 hours at minute 20 (after clubs and grounds)
  const schedule = process.env.TEAM_SYNC_CRON || '20 */6 * * *';
  cron.schedule(schedule, runTeamSync, { timezone: 'Europe/Moscow' });
}
