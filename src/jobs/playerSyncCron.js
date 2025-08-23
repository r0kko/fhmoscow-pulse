import cron from 'node-cron';

import playerService from '../services/playerService.js';
import clubService from '../services/clubService.js';
import teamService from '../services/teamService.js';
import logger from '../../logger.js';

let running = false;

export async function runPlayerSync() {
  if (running) return;
  running = true;
  try {
    // Keep clubs/teams updated to maintain relations
    const clubStats = await clubService.syncExternal();
    const teamStats = await teamService.syncExternal();
    const stats = await playerService.syncExternal();
    logger.info(
      'Player sync completed: clubs(upserted=%d, softDeleted=%d); teams(upserted=%d, softDeleted=%d); players(upserted=%d, softDeleted=%d); roles(upserted=%d, softDeleted=%d); clubPlayers(upserted=%d, softDeleted=%d); teamPlayers(upserted=%d, softDeleted=%d)',
      clubStats.upserts,
      clubStats.softDeletedTotal,
      teamStats.upserts,
      teamStats.softDeletedTotal,
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
  } finally {
    running = false;
  }
}

export default function startPlayerSyncCron() {
  // Default: every 6 hours at minute 40 (after clubs/teams)
  const schedule = process.env.PLAYER_SYNC_CRON || '40 */6 * * *';
  cron.schedule(schedule, runPlayerSync, { timezone: 'Etc/GMT-3' });
}
