import cron from 'node-cron';

import tournamentService from '../services/tournamentService.js';
import clubService from '../services/clubService.js';
import teamService from '../services/teamService.js';
import logger from '../../logger.js';

let running = false;

export async function runTournamentSync() {
  if (running) return;
  running = true;
  try {
    // Keep clubs and teams current to preserve relations
    const clubStats = await clubService.syncExternal();
    const teamStats = await teamService.syncExternal();
    const stats = await tournamentService.syncExternal();
    logger.info(
      'Tournament sync completed: clubs(upserted=%d, softDeleted=%d); teams(upserted=%d, softDeleted=%d); types(upserted=%d, softDeleted=%d); tournaments(upserted=%d, softDeleted=%d); stages(upserted=%d, softDeleted=%d); groups(upserted=%d, softDeleted=%d); tournamentTeams(upserted=%d, softDeleted=%d); tours(upserted=%d, softDeleted=%d); games(upserted=%d, softDeleted=%d)',
      clubStats.upserts,
      clubStats.softDeletedTotal,
      teamStats.upserts,
      teamStats.softDeletedTotal,
      stats.tournament_types.upserts,
      stats.tournament_types.softDeletedTotal,
      stats.tournaments.upserts,
      stats.tournaments.softDeletedTotal,
      stats.stages.upserts,
      stats.stages.softDeletedTotal,
      stats.groups.upserts,
      stats.groups.softDeletedTotal,
      stats.tournament_teams.upserts,
      stats.tournament_teams.softDeletedTotal,
      stats.tours.upserts,
      stats.tours.softDeletedTotal,
      stats.games.upserts,
      stats.games.softDeletedTotal
    );
  } catch (err) {
    logger.error('Tournament sync failed: %s', err.stack || err);
  } finally {
    running = false;
  }
}

export default function startTournamentSyncCron() {
  // Default: every 6 hours at minute 50 (after players)
  const schedule = process.env.TOURNAMENT_SYNC_CRON || '50 */6 * * *';
  cron.schedule(schedule, runTournamentSync, { timezone: 'Etc/GMT-3' });
}
