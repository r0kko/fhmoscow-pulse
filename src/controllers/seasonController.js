import seasonService from '../services/seasonService.js';
import mapper from '../mappers/seasonMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { page = '1', limit = '100' } = req.query;
    try {
      const { rows, count } = await seasonService.listAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });
      return res.json({ seasons: rows.map(mapper.toPublic), total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async getActive(_req, res) {
    try {
      const season = await seasonService.getActive();
      if (!season) return res.json({ season: null });
      return res.json({ season: mapper.toPublic(season) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
