import groundService from '../services/groundService.js';
import { sendError } from '../utils/api.js';

export default {
  async sync(req, res) {
    try {
      const result = await groundService.syncExternal(req.user?.id);
      return res.json({ synced: true, ...result });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
