import seasonService from '../services/seasonService.js';
import mapper from '../mappers/seasonMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { page = '1', limit = '20' } = req.query;
    const { rows, count } = await seasonService.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    return res.json({ seasons: rows.map(mapper.toPublic), total: count });
  },

  async get(req, res) {
    try {
      const season = await seasonService.getById(req.params.id);
      return res.json({ season: mapper.toPublic(season) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  // seasons are read-only via API
};
