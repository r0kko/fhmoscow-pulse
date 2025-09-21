import cron from 'node-cron';

import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';
import logger from '../../logger.js';
import penaltyService from '../services/gamePenaltySyncService.js';
import {
  isExternalDbAvailable,
  connectExternalMariaDb,
} from '../config/externalMariaDb.js';

export async function runGamePenaltySync() {
  await withRedisLock(
    buildJobLockKey('gamePenaltySync'),
    60 * 60_000, // 1 hour lock TTL
    async () => {
      await withJobMetrics('gamePenaltySync', async () => {
        try {
          if (!isExternalDbAvailable()) {
            try {
              await connectExternalMariaDb();
            } catch (_e) {
              /* empty */
            }
          }
          if (!isExternalDbAvailable()) {
            logger.warn('GamePenalty sync skipped: external DB unavailable');
            return;
          }
          const { mode, cursor, outcome } = await runWithSyncState(
            'gamePenaltySync',
            async ({ mode }) => {
              const stats = await penaltyService.syncExternal({ mode });
              return {
                cursor: stats.cursor,
                stats,
                fullSync: stats.fullSync === true,
              };
            },
            { forceMode: 'full' }
          );
          const stats = outcome?.stats || { upserts: 0, softDeleted: 0 };
          logger.info(
            'GamePenalty full sync completed (mode=%s, cursor=%s): upserted=%d, softDeleted=%d',
            mode,
            cursor ? new Date(cursor).toISOString() : 'n/a',
            stats.upserts,
            stats.softDeleted
          );
        } catch (err) {
          logger.error('GamePenalty sync failed: %s', err.stack || err);
          throw err;
        }
      });
    }
  );
}

let scheduled = false;
let task = null;

export default function startGamePenaltySyncCron() {
  if (scheduled) return;
  // Schedule hourly at minute 5 to avoid top-of-hour spikes
  const schedule = '5 * * * *';
  task = cron.schedule(schedule, runGamePenaltySync, {
    timezone: 'Europe/Moscow',
  });
  scheduled = true;
}

export function _getGamePenaltyCronTask() {
  return task;
}
