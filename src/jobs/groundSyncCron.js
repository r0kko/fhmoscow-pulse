import cron from 'node-cron';

import groundService from '../services/groundService.js';
import logger from '../../logger.js';

let running = false;

export async function runGroundSync() {
  if (running) return;
  running = true;
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
  } finally {
    running = false;
  }
}

export default function startGroundSyncCron() {
  // Default: every 6 hours at minute 10 (after clubs)
  const schedule = process.env.GROUND_SYNC_CRON || '10 */6 * * *';
  cron.schedule(schedule, runGroundSync, { timezone: 'Etc/GMT-3' });
}
