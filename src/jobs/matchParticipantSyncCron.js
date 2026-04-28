import matchParticipantSyncService from '../services/matchParticipantSyncService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

let running = false;

export async function runMatchParticipantSync() {
  if (running) return;
  await withRedisLock(
    buildJobLockKey('matchParticipantSync'),
    60 * 60_000,
    async () => {
      running = true;
      await withJobMetrics('matchParticipantSync', async () => {
        try {
          const { mode, outcome } = await runWithSyncState(
            'matchParticipantSync',
            async () => {
              const stats = await matchParticipantSyncService.syncExternal();
              return { cursor: null, stats, fullSync: true };
            },
            { forceMode: 'full' }
          );
          const stats = outcome?.stats || {};
          const players = stats.players || { upserts: 0, softDeleted: 0 };
          const staff = stats.staff || { upserts: 0, softDeleted: 0 };
          logger.info(
            'Match participant sync completed (mode=%s): matches=%d players(upserted=%d, softDeleted=%d); staff(upserted=%d, softDeleted=%d)',
            mode,
            stats.matches || 0,
            players.upserts,
            players.softDeleted,
            staff.upserts,
            staff.softDeleted
          );
        } catch (err) {
          logger.error('Match participant sync failed: %s', err.stack || err);
          throw err;
        } finally {
          running = false;
        }
      });
    }
  );
}

export function isMatchParticipantSyncRunning() {
  return running;
}

export function resetMatchParticipantSyncState() {
  running = false;
}
