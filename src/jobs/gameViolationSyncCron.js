import cron from 'node-cron';

import gameViolationService from '../services/gameViolationService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

let running = false;

export async function runGameViolationSync() {
  if (running) return;
  await withRedisLock(
    buildJobLockKey('gameViolationSync'),
    15 * 60_000,
    async () => {
      running = true;
      await withJobMetrics('gameViolationSync', async () => {
        try {
          const { mode, cursor, outcome } = await runWithSyncState(
            'gameViolationSync',
            async ({ mode }) => {
              const stats = await gameViolationService.syncExternal({ mode });
              return {
                cursor: stats.cursor,
                stats,
                fullSync: stats.fullSync === true,
              };
            }
          );
          const stats = outcome?.stats || { upserts: 0, softDeleted: 0 };
          logger.info(
            'GameViolation sync completed (mode=%s, cursor=%s): upserted=%d, softDeleted=%d',
            mode,
            cursor ? new Date(cursor).toISOString() : 'n/a',
            stats.upserts,
            stats.softDeleted
          );
        } catch (err) {
          logger.error('GameViolation sync failed: %s', err.stack || err);
          throw err;
        } finally {
          running = false;
        }
      });
    }
  );
}

export default function startGameViolationSyncCron() {
  // Fixed schedule: every 6 hours at minute 58
  const schedule = '58 */6 * * *';
  cron.schedule(schedule, runGameViolationSync, { timezone: 'Europe/Moscow' });
}
