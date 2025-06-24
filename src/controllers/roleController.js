import roleService from '../services/roleService.js';

export default {
  async list(_req, res) {
    const roles = await roleService.listRoles();
    return res.json({ roles });
  },
};
