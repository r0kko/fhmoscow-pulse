import roleService from '../services/roleService.js';
import roleMapper from '../mappers/roleMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(_req, res) {
    try {
      const roles = await roleService.listRoles();
      return res.json({ roles: roles.map(roleMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
