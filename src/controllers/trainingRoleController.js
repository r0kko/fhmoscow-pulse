import trainingRoleService from '../services/trainingRoleService.js';
import roleMapper from '../mappers/roleMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(_req, res) {
    try {
      const roles = await trainingRoleService.list();
      return res.json({ roles: roles.map(roleMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
