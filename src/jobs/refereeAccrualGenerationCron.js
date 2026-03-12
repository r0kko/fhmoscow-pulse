import cron from 'node-cron';

import logger from '../../logger.js';
import { withJobMetrics } from '../config/metrics.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import accountingService from '../services/refereeAccountingService.js';

let running = false;
let scheduled = false;
let task = null;

export async function runRefereeAccrualGeneration() {
  if (running) return;
  running = true;
  try {
    await withRedisLock(
      buildJobLockKey('refereeAccrualGeneration'),
      30 * 60_000,
      async () => {
        await withJobMetrics('refereeAccrualGeneration', async () => {
          const result = await accountingService.generateAccruals({
            apply: true,
            source: 'CRON',
            actorId: null,
          });
          logger.info(
            'Referee accrual cron: created=%d skipped=%d errors=%d',
            Number(result?.summary?.created || 0),
            Number(result?.summary?.skipped_existing || 0),
            Number(result?.summary?.errors || 0)
          );
          return result;
        });
      }
    );
  } catch (err) {
    logger.error('Referee accrual cron failed: %s', err?.stack || err);
    throw err;
  } finally {
    running = false;
  }
}

export function isRefereeAccrualGenerationRunning() {
  return running;
}

export default function startRefereeAccrualGenerationCron() {
  if (scheduled) return;
  task = cron.schedule(
    '30 3 * * *',
    () => {
      runRefereeAccrualGeneration().catch(() => {});
    },
    {
      timezone: 'Europe/Moscow',
    }
  );
  scheduled = true;
}

export function stopRefereeAccrualGenerationCron() {
  try {
    if (task) task.stop();
  } catch {
    /* noop */
  }
}

export function restartRefereeAccrualGenerationCron() {
  stopRefereeAccrualGenerationCron();
  scheduled = false;
  startRefereeAccrualGenerationCron();
}

export function resetRefereeAccrualGenerationState() {
  running = false;
}
