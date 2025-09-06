import cron from 'node-cron';

import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import {
  isExternalDbAvailable,
  connectExternalMariaDb,
} from '../config/externalMariaDb.js';
import logger from '../../logger.js';

import { runClubSync } from './clubSyncCron.js';
import { runGroundSync } from './groundSyncCron.js';
import { runTeamSync } from './teamSyncCron.js';
import { runStaffSync } from './staffSyncCron.js';
import { runPlayerSync } from './playerSyncCron.js';
import { runTournamentSync } from './tournamentSyncCron.js';
import { runGameEventTypeSync } from './gameEventTypeSyncCron.js';
import { runPenaltyMinutesSync } from './penaltyMinutesSyncCron.js';
import { runGameSituationSync } from './gameSituationSyncCron.js';
import { runGameViolationSync } from './gameViolationSyncCron.js';
import { runBroadcastLinkSync } from './broadcastLinkSyncCron.js';
import { runGamePenaltySync } from './gamePenaltySyncCron.js';

let running = false;
let scheduled = false;
let task = null;

export async function runSyncAll() {
  if (running) return;
  await withRedisLock(
    buildJobLockKey('syncAll'),
    2 * 60 * 60_000, // 2 hours lock TTL
    async () => {
      running = true;
      await withJobMetrics('syncAll', async () => {
        try {
          logger.info('syncAll starting');
          if (!isExternalDbAvailable()) {
            try {
              await connectExternalMariaDb();
            } catch {
              /* empty */
            }
          }
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
          await runGameEventTypeSync();
          await runPenaltyMinutesSync();
          await runGameSituationSync();
          await runGameViolationSync();
          await runGamePenaltySync();
          await runBroadcastLinkSync();
          // Note: deletion-only maintenance runs on its own daily schedule
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

export function isSyncAllRunning() {
  return running;
}

export default function startSyncAllCron() {
  // Hard-coded: run every 30 minutes, MSK timezone
  if (scheduled) return;
  task = cron.schedule('*/30 * * * *', runSyncAll, {
    timezone: 'Europe/Moscow',
  });
  scheduled = true;
}

export function _getSyncAllCronTask() {
  return task;
}

export function stopSyncAllCron() {
  try {
    if (task) task.stop();
  } catch {
    /* noop */
  }
}

export function restartSyncAllCron() {
  stopSyncAllCron();
  scheduled = false;
  startSyncAllCron();
}

export function resetSyncAllState() {
  running = false;
}
