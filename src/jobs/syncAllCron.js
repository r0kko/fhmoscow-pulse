import cron from 'node-cron';

import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
import logger from '../../logger.js';

import { runClubSync } from './clubSyncCron.js';
import { runGroundSync } from './groundSyncCron.js';
import { runTeamSync } from './teamSyncCron.js';
import { runStaffSync } from './staffSyncCron.js';
import { runPlayerSync } from './playerSyncCron.js';
import { runTournamentSync } from './tournamentSyncCron.js';

let running = false;

export async function runSyncAll() {
  if (running) return;
  await withRedisLock(
    buildJobLockKey('syncAll'),
    2 * 60 * 60_000, // 2 hours lock TTL
    async () => {
      running = true;
      await withJobMetrics('syncAll', async () => {
        try {
          if (!isExternalDbAvailable()) {
            logger.warn('syncAll skipped: external DB unavailable');
            return;
          }
          await runClubSync();
          await runGroundSync();
          await runTeamSync();
          await runStaffSync();
          await runPlayerSync();
          await runTournamentSync();
          logger.info('syncAll completed successfully');
        } catch (err) {
          logger.error('syncAll failed: %s', err.stack || err);
          throw err;
        } finally {
          running = false;
        }
      });
    }
  );
}

export default function startSyncAllCron() {
  const schedule = process.env.SYNC_ALL_CRON || '0 */6 * * *';
  cron.schedule(schedule, runSyncAll, { timezone: 'Europe/Moscow' });
}
