import cron from 'node-cron';

import playerService from '../services/playerService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

let running = false;

export async function runPlayerSync() {
  if (running) return;
  await withRedisLock(buildJobLockKey('playerSync'), 60 * 60_000, async () => {
    running = true;
    await withJobMetrics('playerSync', async () => {
      try {
        const { mode, cursor, outcome } = await runWithSyncState(
          'playerSync',
          async ({ mode, since }) => {
            const stats = await playerService.syncExternal({ mode, since });
            return {
              cursor: stats.cursor,
              stats,
              fullSync: stats.fullSync === true,
            };
          }
        );
        const stats = outcome?.stats || {};
        const extFiles = stats.ext_files || {};
        const players = stats.players || { upserts: 0, softDeletedTotal: 0 };
        const roles = stats.player_roles || {
          upserts: 0,
          softDeletedTotal: 0,
        };
        const clubPlayers = stats.club_players || {
          upserts: 0,
          softDeletedTotal: 0,
        };
        const teamPlayers = stats.team_players || {
          upserts: 0,
          softDeletedTotal: 0,
        };
        logger.info(
          'Player photo files sync completed (mode=%s, cursor=%s): upserted=%d, restored=%d, archivedCreated=%d, softDeletedArchived=%d, softDeletedMissing=%d, softDeletedByStatus=%d',
          mode,
          cursor ? new Date(cursor).toISOString() : 'n/a',
          extFiles.upserts ?? 0,
          extFiles.restored ?? 0,
          extFiles.createdArchived ?? 0,
          extFiles.softDeletedArchived ?? 0,
          extFiles.softDeletedMissing ?? 0,
          extFiles.softDeletedByStatus ?? 0
        );
        logger.info(
          'Player sync completed (mode=%s): players(upserted=%d, softDeleted=%d); roles(upserted=%d, softDeleted=%d); clubPlayers(upserted=%d, softDeleted=%d); teamPlayers(upserted=%d, softDeleted=%d)',
          mode,
          players.upserts,
          players.softDeletedTotal,
          roles.upserts,
          roles.softDeletedTotal,
          clubPlayers.upserts,
          clubPlayers.softDeletedTotal,
          teamPlayers.upserts,
          teamPlayers.softDeletedTotal
        );
      } catch (err) {
        logger.error('Player sync failed: %s', err.stack || err);
        throw err;
      } finally {
        running = false;
      }
    });
  });
}

export default function startPlayerSyncCron() {
  // Fixed schedule: every 6 hours at minute 40 (after clubs/teams)
  const schedule = '40 */6 * * *';
  cron.schedule(schedule, runPlayerSync, { timezone: 'Europe/Moscow' });
}
