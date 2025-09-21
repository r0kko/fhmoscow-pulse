import groundService from '../services/groundService.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
import { sendError } from '../utils/api.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';
import { runWithSyncState } from '../services/syncStateService.js';

export default {
  async sync(req, res) {
    try {
      if (!isExternalDbAvailable()) {
        return res.status(503).json({ error: 'external_unavailable' });
      }
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
        buildJobLockKey('groundSync'),
        30 * 60_000,
        async () => {
          await withJobMetrics('groundSync_manual', async () => {
            const { mode, cursor, state, outcome } = await runWithSyncState(
              'groundSync',
              async ({ mode, since }) => {
                const stats = await groundService.syncExternal({
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
            payload = {
              synced: true,
              mode,
              cursor: cursor ? cursor.toISOString() : null,
              fullSync: stats.fullSync === true || mode === 'full',
              state,
              ...stats,
              stats,
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
