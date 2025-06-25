import { validationResult } from 'express-validator';

import snilsService from '../services/snilsService.js';
import snilsMapper from '../mappers/snilsMapper.js';
import legacyService from '../services/legacyUserService.js';
import { UserExternalId } from '../models/index.js';

export default {
  async me(req, res) {
    if (req.query.prefill !== '1') {
      return res.status(404).json({ error: 'snils_not_found' });
    }
    const snils = await snilsService.getByUser(req.user.id);
    if (snils) {
      return res.json({ snils: snilsMapper.toPublic(snils) });
    }
    const ext = await UserExternalId.findOne({
      where: { user_id: req.user.id },
    });
    if (!ext) {
      return res.status(404).json({ error: 'snils_not_found' });
    }
    const legacy = await legacyService.findById(ext.external_id);
    if (legacy?.sv_ops) {
      return res.json({ snils: { number: legacy.sv_ops } });
    }
    return res.status(404).json({ error: 'snils_not_found' });
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
