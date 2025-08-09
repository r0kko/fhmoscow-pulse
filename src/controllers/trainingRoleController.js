import trainingRoleService from '../services/trainingRoleService.js';
import roleMapper from '../mappers/roleMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const opts = {};
      if (req.query.forCamp !== undefined) {
        opts.forCamp = req.query.forCamp === 'true';
      }
      const roles = await trainingRoleService.list(opts);
      return res.json({ roles: roles.map(roleMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
