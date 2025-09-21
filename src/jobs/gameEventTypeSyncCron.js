import cron from 'node-cron';

import gameEventTypeService from '../services/gameEventTypeService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

let running = false;

export async function runGameEventTypeSync() {
  if (running) return;
  await withRedisLock(
    buildJobLockKey('gameEventTypeSync'),
    15 * 60_000,
    async () => {
      running = true;
      await withJobMetrics('gameEventTypeSync', async () => {
        try {
          const { mode, cursor, outcome } = await runWithSyncState(
            'gameEventTypeSync',
            async ({ mode }) => {
              const stats = await gameEventTypeService.syncExternal({ mode });
              return {
                cursor: stats.cursor,
                stats,
                fullSync: stats.fullSync === true,
              };
            }
          );
          const stats = outcome?.stats || { upserts: 0, softDeleted: 0 };
          logger.info(
            'GameEventType sync completed (mode=%s, cursor=%s): upserted=%d, softDeleted=%d',
            mode,
            cursor ? new Date(cursor).toISOString() : 'n/a',
            stats.upserts,
            stats.softDeleted
          );
        } catch (err) {
          logger.error('GameEventType sync failed: %s', err.stack || err);
          throw err;
        } finally {
          running = false;
        }
      });
    }
  );
}

export default function startGameEventTypeSyncCron() {
  // Fixed schedule: every 6 hours at :55 (near tournament sync)
  const schedule = '55 */6 * * *';
  cron.schedule(schedule, runGameEventTypeSync, { timezone: 'Europe/Moscow' });
}
