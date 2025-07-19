import measurementUnitService from '../services/measurementUnitService.js';
import mapper from '../mappers/measurementUnitMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(_req, res) {
    try {
      const units = await measurementUnitService.list();
      return res.json({ units: units.map(mapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
