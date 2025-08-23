import groundService from '../services/groundService.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
import { sendError } from '../utils/api.js';

export default {
  async sync(req, res) {
    try {
      if (!isExternalDbAvailable()) {
        return res.status(503).json({ error: 'external_unavailable' });
      }
      const result = await groundService.syncExternal(req.user?.id);
      return res.json({ synced: true, ...result });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
