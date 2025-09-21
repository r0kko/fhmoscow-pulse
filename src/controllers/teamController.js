import teamService from '../services/teamService.js';
import clubService from '../services/clubService.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
import teamMapper from '../mappers/teamMapper.js';
import { sendError } from '../utils/api.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

export default {
  async list(req, res) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        q,
        club_id,
        birth_year,
        status,
        include,
        withGrounds,
      } = req.query;
      const includeGrounds =
        withGrounds === 'true' ||
        include === 'grounds' ||
        (Array.isArray(include) && include.includes('grounds'));
      const { rows, count } = await teamService.list({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search: search || q || undefined,
        club_id,
        birth_year,
        status,
        includeGrounds,
      });
      return res.json({ teams: rows.map(teamMapper.toPublic), total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async sync(req, res) {
    try {
      if (!isExternalDbAvailable()) {
        return res.status(503).json({ error: 'external_unavailable' });
      }
      // Keep clubs in sync first to maintain relations and accurate soft-deletes
      let payload = null;
      const requestedMode = String(
        req.body?.mode || req.query?.mode || ''
      ).toLowerCase();
      const modeOverride =
        requestedMode === 'full'
          ? 'full'
          : requestedMode === 'incremental'
            ? 'incremental'
            : null;
      await withRedisLock(
        buildJobLockKey('teamSync'),
        30 * 60_000,
        async () => {
          await withJobMetrics('teamSync_manual', async () => {
            const clubRun = await runWithSyncState(
              'clubSync',
              async ({ mode, since }) => {
                const stats = await clubService.syncExternal({
                  actorId: req.user?.id,
                  mode,
                  since,
                });
                return {
                  cursor: stats.cursor,
                  stats,
                  fullSync: stats.fullSync === true,
                };
              },
              modeOverride ? { forceMode: modeOverride } : undefined
            );
            const teamRun = await runWithSyncState(
              'teamSync',
              async ({ mode, since }) => {
                const stats = await teamService.syncExternal({
                  actorId: req.user?.id,
                  mode,
                  since,
                });
                return {
                  cursor: stats.cursor,
                  stats,
                  fullSync: stats.fullSync === true,
                };
              },
              modeOverride ? { forceMode: modeOverride } : undefined
            );
            const clubStats = clubRun.outcome?.stats || {};
            const teamStats = teamRun.outcome?.stats || {};
            const teams = await teamService.listAll();
            payload = {
              stats: { clubs: clubStats, teams: teamStats },
              modes: { clubs: clubRun.mode, teams: teamRun.mode },
              cursors: {
                clubs: clubRun.cursor ? clubRun.cursor.toISOString() : null,
                teams: teamRun.cursor ? teamRun.cursor.toISOString() : null,
              },
              states: { clubs: clubRun.state, teams: teamRun.state },
              teams: teams.map(teamMapper.toPublic),
            };
          });
        },
        { onBusy: () => null }
      );
      if (payload) return res.json(payload);
      return res.status(409).json({ error: 'sync_in_progress' });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
