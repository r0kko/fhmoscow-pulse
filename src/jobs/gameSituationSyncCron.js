import cron from 'node-cron';

import gameSituationService from '../services/gameSituationService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

let running = false;

export async function runGameSituationSync() {
  if (running) return;
  await withRedisLock(
    buildJobLockKey('gameSituationSync'),
    15 * 60_000,
    async () => {
      running = true;
      await withJobMetrics('gameSituationSync', async () => {
        try {
          const { mode, cursor, outcome } = await runWithSyncState(
            'gameSituationSync',
            async ({ mode }) => {
              const stats = await gameSituationService.syncExternal({ mode });
              return {
                cursor: stats.cursor,
                stats,
                fullSync: stats.fullSync === true,
              };
            }
          );
          const stats = outcome?.stats || { upserts: 0, softDeleted: 0 };
          logger.info(
            'GameSituation sync completed (mode=%s, cursor=%s): upserted=%d, softDeleted=%d',
            mode,
            cursor ? new Date(cursor).toISOString() : 'n/a',
            stats.upserts,
            stats.softDeleted
          );
        } catch (err) {
          logger.error('GameSituation sync failed: %s', err.stack || err);
          throw err;
        } finally {
          running = false;
        }
      });
    }
  );
}

export default function startGameSituationSyncCron() {
  // Fixed schedule: every 6 hours at minute 57
  const schedule = '57 */6 * * *';
  cron.schedule(schedule, runGameSituationSync, { timezone: 'Europe/Moscow' });
}
