import cron from 'node-cron';

import staffService from '../services/staffService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';

let running = false;

export async function runStaffSync() {
  if (running) return;
  await withRedisLock(buildJobLockKey('staffSync'), 45 * 60_000, async () => {
    running = true;
    await withJobMetrics('staffSync', async () => {
      try {
        const stats = await staffService.syncExternal();
        logger.info(
          'Staff sync completed: staff(upserted=%d, softDeleted=%d); categories(upserted=%d, softDeleted=%d); clubStaff(upserted=%d, softDeleted=%d); teamStaff(upserted=%d, softDeleted=%d)',
          stats.staff.upserts,
          stats.staff.softDeletedTotal,
          stats.staff_categories.upserts,
          stats.staff_categories.softDeletedTotal,
          stats.club_staff.upserts,
          stats.club_staff.softDeletedTotal,
          stats.team_staff.upserts,
          stats.team_staff.softDeletedTotal
        );
      } catch (err) {
        logger.error('Staff sync failed: %s', err.stack || err);
        throw err;
      } finally {
        running = false;
      }
    });
  });
}

export default function startStaffSyncCron() {
  // Fixed schedule: every 6 hours at minute 35 (after teams, before players)
  const schedule = '35 */6 * * *';
  cron.schedule(schedule, runStaffSync, { timezone: 'Europe/Moscow' });
}
