import cron from 'node-cron';
import { literal } from 'sequelize';

import { User, Inn, Taxation } from '../models/index.js';
import taxationService from '../services/taxationService.js';
import logger from '../../logger.js';
import { withJobMetrics } from '../config/metrics.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';

let running = false;
let scheduled = false;
let task = null;

export async function runTaxationCheck({ batch } = {}) {
  if (running) return;
  running = true;
  try {
    await withRedisLock(buildJobLockKey('taxation'), 10 * 60_000, async () => {
      const batchSize = Math.max(
        1,
        Number(batch || process.env.TAXATION_CRON_BATCH_SIZE || 1) || 1
      );
      await withJobMetrics('taxation', async () => {
        try {
          for (let i = 0; i < batchSize; i += 1) {
            const user = await User.findOne({
              include: [
                {
                  model: Inn,
                  required: true,
                  attributes: ['number', 'created_at'],
                },
                {
                  model: Taxation,
                  required: false,
                  attributes: ['check_date'],
                },
              ],
              order: [
                [literal('"Taxation"."check_date" IS NULL'), 'DESC'],
                [Taxation, 'check_date', 'ASC'],
                [Inn, 'created_at', 'ASC'],
              ],
            });

            if (!user?.Inn?.number) {
              if (i === 0) logger.debug('Taxation cron: no users to update');
              break;
            }

            const data = await taxationService.fetchByInn(user.Inn.number);
            const { dadata, fns } = data.statuses || {};
            const dadataOk = dadata >= 200 && dadata < 300;
            const fnsOk = fns >= 200 && fns < 300;
            if (dadataOk && fnsOk) {
              await taxationService.updateByInn(
                user.id,
                user.Inn.number,
                null,
                data
              );
              logger.info('Taxation cron updated user %s', user.id);
            } else {
              logger.warn(
                'Taxation cron skipped user %s due to API failure %o',
                user.id,
                data.statuses
              );
            }
          }
        } catch (err) {
          logger.error('Taxation cron failed: %s', err.stack || err);
          throw err;
        }
      });
    });
  } finally {
    running = false;
  }
}

export function isTaxationRunning() {
  return running;
}

export default function startTaxationCron() {
  if (scheduled) return;
  const schedule = '*/4 * * * *';
  task = cron.schedule(schedule, () => runTaxationCheck({}), {
    timezone: 'Europe/Moscow',
  });
  scheduled = true;
}

export function stopTaxationCron() {
  try {
    if (task) task.stop();
  } catch {
    /* noop */
  }
}

export function restartTaxationCron() {
  stopTaxationCron();
  scheduled = false;
  startTaxationCron();
}

export function resetTaxationState() {
  running = false;
}
