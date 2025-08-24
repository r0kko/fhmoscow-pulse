import cron from 'node-cron';

import staffService from '../services/staffService.js';
import clubService from '../services/clubService.js';
import teamService from '../services/teamService.js';
import logger from '../../logger.js';

let running = false;

export async function runStaffSync() {
  if (running) return;
  running = true;
  try {
    // Keep clubs/teams updated to maintain relations
    const clubStats = await clubService.syncExternal();
    const teamStats = await teamService.syncExternal();
    const stats = await staffService.syncExternal();
    logger.info(
      'Staff sync completed: clubs(upserted=%d, softDeleted=%d); teams(upserted=%d, softDeleted=%d); staff(upserted=%d, softDeleted=%d); categories(upserted=%d, softDeleted=%d); clubStaff(upserted=%d, softDeleted=%d); teamStaff(upserted=%d, softDeleted=%d)',
      clubStats.upserts,
      clubStats.softDeletedTotal,
      teamStats.upserts,
      teamStats.softDeletedTotal,
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
  } finally {
    running = false;
  }
}

export default function startStaffSyncCron() {
  // Default: every 6 hours at minute 35 (after teams, before players)
  const schedule = process.env.STAFF_SYNC_CRON || '35 */6 * * *';
  cron.schedule(schedule, runStaffSync, { timezone: 'Etc/GMT-3' });
}
