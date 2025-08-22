import cron from 'node-cron';

import clubService from '../services/clubService.js';
import logger from '../../logger.js';

let running = false;

export async function runClubSync() {
  if (running) return;
  running = true;
  try {
    await clubService.syncExternal();
    logger.info('Club sync completed');
  } catch (err) {
    logger.error('Club sync failed: %s', err.stack || err);
  } finally {
    running = false;
  }
}

export default function startClubSyncCron() {
  const schedule = process.env.CLUB_SYNC_CRON || '*/10 * * * *'; // every 10 minutes by default
  cron.schedule(schedule, runClubSync, { timezone: 'Etc/GMT-3' });
}
