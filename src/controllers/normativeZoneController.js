import normativeZoneService from '../services/normativeZoneService.js';
import mapper from '../mappers/normativeZoneMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const zones = await normativeZoneService.list({
        season_id: req.query.season_id,
      });
      return res.json({ zones: zones.map(mapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
