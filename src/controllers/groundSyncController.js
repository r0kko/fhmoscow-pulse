import groundService from '../services/groundService.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
import { sendError } from '../utils/api.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';
import { withJobMetrics } from '../config/metrics.js';

export default {
  async sync(req, res) {
    try {
      if (!isExternalDbAvailable()) {
        return res.status(503).json({ error: 'external_unavailable' });
      }
      let payload = null;
      await withRedisLock(
        buildJobLockKey('groundSync'),
        30 * 60_000,
        async () => {
          await withJobMetrics('groundSync_manual', async () => {
            const result = await groundService.syncExternal(req.user?.id);
            payload = { synced: true, ...result };
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
