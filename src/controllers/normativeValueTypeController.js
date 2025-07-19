import normativeValueTypeService from '../services/normativeValueTypeService.js';
import mapper from '../mappers/normativeValueTypeMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(_req, res) {
    try {
      const types = await normativeValueTypeService.list();
      return res.json({ valueTypes: types.map(mapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
