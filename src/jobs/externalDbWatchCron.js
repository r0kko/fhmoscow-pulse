import cron from 'node-cron';

import externalSequelize, {
  connectExternalMariaDb,
  isExternalDbAvailable,
} from '../config/externalMariaDb.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import logger from '../../logger.js';

import { runSyncAll } from './syncAllCron.js';

let wasAvailable = false;

async function checkAndTrigger() {
  try {
    // Attempt to (re)connect; ignore errors to keep watch lightweight
    try {
      await connectExternalMariaDb();
    } catch {
      /* empty */
    }
    const available = isExternalDbAvailable();
    if (available) {
      // Keep the connection warm with a lightweight ping to avoid idle disconnects
      try {
        await externalSequelize.query('SELECT 1');
      } catch {
        // If ping fails, try to re-establish the connection on the next tick
      }
    }
    if (available && !wasAvailable) {
      // Transition: became available — trigger orchestrator guarded by a short lock
      await withRedisLock(
        buildJobLockKey('extDbConnectTrigger'),
        2 * 60_000,
        async () => {
          logger.info(
            'External DB became available. Triggering syncAll orchestrator.'
          );
          // Fire-and-forget, runSyncAll has its own lock/metrics
          runSyncAll().catch(() => {});
        }
      );
    }
    wasAvailable = available;
  } catch (err) {
    logger.warn(
      'externalDbWatch check failed: %s',
      err?.message || String(err)
    );
  }
}

export default function startExternalDbWatchCron() {
  // Fixed schedule: every minute
  const schedule = '*/1 * * * *';
  cron.schedule(schedule, checkAndTrigger, { timezone: 'Europe/Moscow' });
}
