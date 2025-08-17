import cron from 'node-cron';

import teamService from '../services/teamService.js';
import logger from '../../logger.js';

let running = false;

export async function runTeamSync() {
  if (running) return;
  running = true;
  try {
    await teamService.syncExternal();
    logger.info('Team sync completed');
  } catch (err) {
    logger.error('Team sync failed: %s', err.stack || err);
  } finally {
    running = false;
  }
}

export default function startTeamSyncCron() {
  cron.schedule('0 * * * *', runTeamSync);
}
