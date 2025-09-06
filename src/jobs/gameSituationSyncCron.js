import cron from 'node-cron';

import gameSituationService from '../services/gameSituationService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';

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
          const stats = await gameSituationService.syncExternal();
          logger.info(
            'GameSituation sync completed: upserted=%d, softDeleted=%d',
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
  const schedule = process.env.GAME_SITUATION_SYNC_CRON || '57 */6 * * *';
  cron.schedule(schedule, runGameSituationSync, { timezone: 'Europe/Moscow' });
}
