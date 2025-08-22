import cron from 'node-cron';

import clubService from '../services/clubService.js';
import logger from '../../logger.js';

let running = false;

export async function runClubSync() {
  if (running) return;
  running = true;
  try {
    const stats = await clubService.syncExternal();
    logger.info(
      'Club sync completed: upserted=%d, softDeleted=%d (archived=%d, missing=%d)',
      stats.upserts,
      stats.softDeletedTotal,
      stats.softDeletedArchived,
      stats.softDeletedMissing
    );
  } catch (err) {
    logger.error('Club sync failed: %s', err.stack || err);
  } finally {
    running = false;
  }
}

export default function startClubSyncCron() {
  // Default: every 6 hours at minute 0
  const schedule = process.env.CLUB_SYNC_CRON || '0 */6 * * *';
  cron.schedule(schedule, runClubSync, { timezone: 'Etc/GMT-3' });
}
