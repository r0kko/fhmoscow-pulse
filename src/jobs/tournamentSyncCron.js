import cron from 'node-cron';

import tournamentService from '../services/tournamentService.js';
import logger from '../../logger.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

let running = false;

export async function runTournamentSync() {
  if (running) return;
  await withRedisLock(
    buildJobLockKey('tournamentSync'),
    60 * 60_000,
    async () => {
      running = true;
      await withJobMetrics('tournamentSync', async () => {
        try {
          const { mode, cursor, outcome } = await runWithSyncState(
            'tournamentSync',
            async ({ mode, since }) => {
              const stats = await tournamentService.syncExternal({
                mode,
                since,
              });
              return {
                cursor: stats.cursor,
                stats,
                fullSync: stats.fullSync === true,
              };
            },
            { fullIntervalMs: 24 * 60 * 60 * 1000 }
          );
          const stats = outcome?.stats || {};
          const tTypes = stats.tournament_types || {
            upserts: 0,
            softDeletedTotal: 0,
          };
          const tournaments = stats.tournaments || {
            upserts: 0,
            softDeletedTotal: 0,
          };
          const stages = stats.stages || {
            upserts: 0,
            softDeletedTotal: 0,
          };
          const groups = stats.groups || {
            upserts: 0,
            softDeletedTotal: 0,
          };
          const tt = stats.tournament_teams || {
            upserts: 0,
            softDeletedTotal: 0,
          };
          const tours = stats.tours || {
            upserts: 0,
            softDeletedTotal: 0,
          };
          const games = stats.games || {
            upserts: 0,
            softDeletedTotal: 0,
          };
          logger.info(
            'Tournament sync completed (mode=%s, cursor=%s): types(upserted=%d, softDeleted=%d); tournaments(upserted=%d, softDeleted=%d); stages(upserted=%d, softDeleted=%d); groups(upserted=%d, softDeleted=%d); tournamentTeams(upserted=%d, softDeleted=%d); tours(upserted=%d, softDeleted=%d); games(upserted=%d, softDeleted=%d)',
            mode,
            cursor ? new Date(cursor).toISOString() : 'n/a',
            tTypes.upserts,
            tTypes.softDeletedTotal,
            tournaments.upserts,
            tournaments.softDeletedTotal,
            stages.upserts,
            stages.softDeletedTotal,
            groups.upserts,
            groups.softDeletedTotal,
            tt.upserts,
            tt.softDeletedTotal,
            tours.upserts,
            tours.softDeletedTotal,
            games.upserts,
            games.softDeletedTotal
          );
        } catch (err) {
          logger.error('Tournament sync failed: %s', err.stack || err);
          throw err;
        } finally {
          running = false;
        }
      });
    }
  );
}

export default function startTournamentSyncCron() {
  // Fixed schedule: every 6 hours at minute 50 (after players)
  const schedule = '50 */6 * * *';
  cron.schedule(schedule, runTournamentSync, { timezone: 'Europe/Moscow' });
}
