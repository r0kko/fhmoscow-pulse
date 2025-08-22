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
    await clubService.syncExternal();
    await teamService.syncExternal();
    logger.info('Team sync completed');
  } catch (err) {
    logger.error('Team sync failed: %s', err.stack || err);
  } finally {
    running = false;
  }
}

export default function startTeamSyncCron() {
  const schedule = process.env.TEAM_SYNC_CRON || '*/10 * * * *'; // every 10 minutes by default
  cron.schedule(schedule, runTeamSync, { timezone: 'Etc/GMT-3' });
}
