import { validationResult } from 'express-validator';

import snilsService from '../services/snilsService.js';
import snilsMapper from '../mappers/snilsMapper.js';

export default {
  async me(req, res) {
    const snils = await snilsService.getByUser(req.user.id);
    if (!snils) {
      return res.status(404).json({ error: 'snils_not_found' });
    }
    return res.json({ snils: snilsMapper.toPublic(snils) });
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const snils = await snilsService.create(
        req.user.id,
        req.body.number,
        req.user.id
      );
      return res.status(201).json({ snils: snilsMapper.toPublic(snils) });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};
