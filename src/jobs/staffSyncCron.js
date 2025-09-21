import cron from 'node-cron';

import staffService from '../services/staffService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

let running = false;

export async function runStaffSync() {
  if (running) return;
  await withRedisLock(buildJobLockKey('staffSync'), 45 * 60_000, async () => {
    running = true;
    await withJobMetrics('staffSync', async () => {
      try {
        const { mode, cursor, outcome } = await runWithSyncState(
          'staffSync',
          async ({ mode, since }) => {
            const stats = await staffService.syncExternal({ mode, since });
            return {
              cursor: stats.cursor,
              stats,
              fullSync: stats.fullSync === true,
            };
          }
        );
        const stats = outcome?.stats || {
          staff: { upserts: 0, softDeletedTotal: 0 },
          staff_categories: { upserts: 0, softDeletedTotal: 0 },
          club_staff: { upserts: 0, softDeletedTotal: 0 },
          team_staff: { upserts: 0, softDeletedTotal: 0 },
        };
        logger.info(
          'Staff sync completed (mode=%s, cursor=%s): staff(upserted=%d, softDeleted=%d); categories(upserted=%d, softDeleted=%d); clubStaff(upserted=%d, softDeleted=%d); teamStaff(upserted=%d, softDeleted=%d)',
          mode,
          cursor ? new Date(cursor).toISOString() : 'n/a',
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
