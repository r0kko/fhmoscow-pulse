import { validationResult } from 'express-validator';

import signTypeService from '../services/signTypeService.js';
import { sendError } from '../utils/api.js';

export default {
  async list(_req, res) {
    const types = await signTypeService.list();
    res.json({
      signTypes: types.map((t) => ({ name: t.name, alias: t.alias })),
    });
  },

  async me(req, res) {
    const type = await signTypeService.getByUser(req.user.id);
    res.json({
      signType: type ? { name: type.name, alias: type.alias } : null,
    });
  },

  async select(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { alias, code } = req.body;
    try {
      const type = await signTypeService.select(req.user, alias, code);
      res.json({ signType: { name: type.name, alias: type.alias } });
    } catch (err) {
      sendError(res, err);
    }
  },
};
