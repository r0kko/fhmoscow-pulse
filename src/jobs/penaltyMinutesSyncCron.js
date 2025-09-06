import cron from 'node-cron';

import penaltyMinutesService from '../services/penaltyMinutesService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';

let running = false;

export async function runPenaltyMinutesSync() {
  if (running) return;
  await withRedisLock(
    buildJobLockKey('penaltyMinutesSync'),
    15 * 60_000,
    async () => {
      running = true;
      await withJobMetrics('penaltyMinutesSync', async () => {
        try {
          const stats = await penaltyMinutesService.syncExternal();
          logger.info(
            'PenaltyMinutes sync completed: upserted=%d, softDeleted=%d',
            stats.upserts,
            stats.softDeleted
          );
        } catch (err) {
          logger.error('PenaltyMinutes sync failed: %s', err.stack || err);
          throw err;
        } finally {
          running = false;
        }
      });
    }
  );
}

export default function startPenaltyMinutesSyncCron() {
  // Fixed schedule: every 6 hours at minute 56
  const schedule = '56 */6 * * *';
  cron.schedule(schedule, runPenaltyMinutesSync, { timezone: 'Europe/Moscow' });
}
