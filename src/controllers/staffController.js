import staffService from '../services/staffService.js';
import clubService from '../services/clubService.js';
import teamService from '../services/teamService.js';
import staffMapper from '../mappers/staffMapper.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
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
        status,
        include,
        withTeams,
        withClubs,
        season,
        club_id,
        team_id,
        mine,
      } = req.query;

      const includeTeams =
        withTeams === 'true' ||
        include === 'teams' ||
        (Array.isArray(include) && include.includes('teams'));
      const includeClubs =
        withClubs === 'true' ||
        include === 'clubs' ||
        (Array.isArray(include) && include.includes('clubs'));

      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);
      const allowedClubIds = scope.allowedClubIds || [];
      const allowedTeamIds = scope.allowedTeamIds || [];
      let clubIds = [];

      if (mine === 'true') {
        if (!allowedClubIds.length && !allowedTeamIds.length)
          return res.status(403).json({ error: 'Доступ запрещён' });
        if (club_id) {
          if (!allowedClubIds.includes(club_id))
            return res.status(403).json({ error: 'Доступ запрещён' });
          clubIds = [club_id];
        } else {
          clubIds = allowedClubIds;
        }
        if (team_id && !allowedTeamIds.includes(team_id))
          return res.status(403).json({ error: 'Доступ запрещён' });
      } else if (isAdmin) {
        if (club_id) clubIds = [club_id];
      } else {
        if (!allowedClubIds.length && !allowedTeamIds.length)
          return res.status(403).json({ error: 'Доступ запрещён' });
        if (club_id) {
          if (!allowedClubIds.includes(club_id))
            return res.status(403).json({ error: 'Доступ запрещён' });
          clubIds = [club_id];
        } else {
          clubIds = allowedClubIds;
        }
        if (team_id && !allowedTeamIds.includes(team_id))
          return res.status(403).json({ error: 'Доступ запрещён' });
      }

      const { rows, count } = await staffService.list({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search: search || q || undefined,
        status,
        includeTeams,
        includeClubs,
        clubIds,
        seasonId: season || undefined,
        teamId: team_id || undefined,
      });
      return res.json({ staff: staffMapper.toPublicArray(rows), total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async sync(req, res) {
    try {
      if (!isExternalDbAvailable()) {
        return res.status(503).json({ error: 'external_unavailable' });
      }
      // Keep related entities in sync first
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
        buildJobLockKey('staffSync'),
        45 * 60_000,
        async () => {
          await withJobMetrics('staffSync_manual', async () => {
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
            const staffRun = await runWithSyncState(
              'staffSync',
              async ({ mode, since }) => {
                const stats = await staffService.syncExternal({
                  actorId: req.user?.id,
                  mode,
                  since,
                });
                return {
                  cursor: stats.staff?.cursor || stats.cursor,
                  stats,
                  fullSync: stats.fullSync === true,
                };
              },
              modeOverride ? { forceMode: modeOverride } : undefined
            );
            const clubStats = clubRun.outcome?.stats || {};
            const teamStats = teamRun.outcome?.stats || {};
            const staffStats = staffRun.outcome?.stats || {};
            const { rows, count } = await staffService.list({
              page: 1,
              limit: 100,
            });
            payload = {
              stats: {
                clubs: clubStats,
                teams: teamStats,
                staff: staffStats.staff || staffStats,
              },
              modes: {
                clubs: clubRun.mode,
                teams: teamRun.mode,
                staff: staffRun.mode,
              },
              cursors: {
                clubs: clubRun.cursor ? clubRun.cursor.toISOString() : null,
                teams: teamRun.cursor ? teamRun.cursor.toISOString() : null,
                staff: staffRun.cursor ? staffRun.cursor.toISOString() : null,
              },
              states: {
                clubs: clubRun.state,
                teams: teamRun.state,
                staff: staffRun.state,
              },
              staff: staffMapper.toPublicArray(rows),
              total: count,
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
