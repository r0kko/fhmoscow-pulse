import sexService from '../services/sexService.js';
import sexMapper from '../mappers/sexMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(_req, res) {
    try {
      const sexes = await sexService.list();
      return res.json({ sexes: sexes.map(sexMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
