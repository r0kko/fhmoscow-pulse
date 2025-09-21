import clubService from '../services/clubService.js';
import clubUserService from '../services/clubUserService.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
import clubMapper from '../mappers/clubMapper.js';
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
        include,
        withTeams,
        mine,
      } = req.query;
      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);

      // If mine=true, always return user's clubs (even for admins with staff role)
      const includeTeams =
        withTeams === 'true' ||
        include === 'teams' ||
        (Array.isArray(include) && include.includes('teams'));
      const includeGrounds =
        include === 'grounds' ||
        (Array.isArray(include) && include.includes('grounds'));
      if (mine === 'true') {
        const clubs = await clubUserService.listUserClubs(
          req.user.id,
          includeTeams
        );
        const filtered =
          search || q
            ? clubs.filter((c) =>
                c.name.toLowerCase().includes(String(search || q).toLowerCase())
              )
            : clubs;
        return res.json({
          clubs: filtered.map(clubMapper.toPublic),
          total: filtered.length,
        });
      }

      // Staff without mine=true — forbid; Admin without mine — full list
      if (!isAdmin) {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }

      const { rows, count } = await clubService.list({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search: search || q || undefined,
        includeTeams,
        includeGrounds,
      });
      return res.json({ clubs: rows.map(clubMapper.toPublic), total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async sync(req, res) {
    try {
      if (!isExternalDbAvailable()) {
        return res.status(503).json({ error: 'external_unavailable' });
      }
      let result = null;
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
        buildJobLockKey('clubSync'),
        30 * 60_000,
        async () => {
          await withJobMetrics('clubSync_manual', async () => {
            const { mode, cursor, state, outcome } = await runWithSyncState(
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
            const stats = outcome?.stats || {};
            const { rows, count } = await clubService.list({
              page: 1,
              limit: 100,
            });
            result = {
              mode,
              cursor: cursor ? cursor.toISOString() : null,
              stats,
              clubs: rows.map(clubMapper.toPublic),
              total: count,
              state,
            };
          });
        },
        {
          onBusy: () => null,
        }
      );
      if (result) return res.json(result);
      return res.status(409).json({ error: 'sync_in_progress' });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
