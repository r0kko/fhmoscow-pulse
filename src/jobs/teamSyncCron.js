import cron from 'node-cron';

import teamService from '../services/teamService.js';
import clubService from '../services/clubService.js';
import logger from '../../logger.js';

let running = false;

export async function runTeamSync() {
  if (running) return;
  running = true;
  try {
    // Keep clubs up-to-date first to preserve relations
    const clubStats = await clubService.syncExternal();
    const stats = await teamService.syncExternal();
    logger.info(
      'Team sync completed: clubs(upserted=%d, softDeleted=%d); teams(upserted=%d, softDeleted=%d)',
      clubStats.upserts,
      clubStats.softDeletedTotal,
      stats.upserts,
      stats.softDeletedTotal
    );
  } catch (err) {
    logger.error('Team sync failed: %s', err.stack || err);
  } finally {
    running = false;
  }
}

export default function startTeamSyncCron() {
  // Default: every 6 hours at minute 20 (after clubs and grounds)
  const schedule = process.env.TEAM_SYNC_CRON || '20 */6 * * *';
  cron.schedule(schedule, runTeamSync, { timezone: 'Etc/GMT-3' });
}
