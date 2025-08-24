import cron from 'node-cron';

import playerService from '../services/playerService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';

let running = false;

export async function runPlayerSync() {
  if (running) return;
  await withRedisLock(buildJobLockKey('playerSync'), 60 * 60_000, async () => {
    running = true;
    await withJobMetrics('playerSync', async () => {
      try {
        const stats = await playerService.syncExternal();
        logger.info(
          'Player sync completed: players(upserted=%d, softDeleted=%d); roles(upserted=%d, softDeleted=%d); clubPlayers(upserted=%d, softDeleted=%d); teamPlayers(upserted=%d, softDeleted=%d)',
          stats.players.upserts,
          stats.players.softDeletedTotal,
          stats.player_roles.upserts,
          stats.player_roles.softDeletedTotal,
          stats.club_players.upserts,
          stats.club_players.softDeletedTotal,
          stats.team_players.upserts,
          stats.team_players.softDeletedTotal
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
  // Default: every 6 hours at minute 40 (after clubs/teams)
  const schedule = process.env.PLAYER_SYNC_CRON || '40 */6 * * *';
  cron.schedule(schedule, runPlayerSync, { timezone: 'Europe/Moscow' });
}
