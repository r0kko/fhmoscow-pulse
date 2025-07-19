import normativeTypeService from '../services/normativeTypeService.js';
import mapper from '../mappers/normativeTypeMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { season_id } = req.query;
    try {
      const { rows } = await normativeTypeService.listAll({
        season_id,
        page: 1,
        limit: 100,
      });
      return res.json({ types: rows.map(mapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
