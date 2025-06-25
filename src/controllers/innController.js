import { validationResult } from 'express-validator';

import innService from '../services/innService.js';
import innMapper from '../mappers/innMapper.js';
import legacyService from '../services/legacyUserService.js';
import { UserExternalId } from '../models/index.js';

export default {
  async me(req, res) {
    let inn = await innService.getByUser(req.user.id);
    if (inn) {
      return res.json({ inn: innMapper.toPublic(inn) });
    }
    const ext = await UserExternalId.findOne({ where: { user_id: req.user.id } });
    if (!ext) {
      return res.status(404).json({ error: 'inn_not_found' });
    }
    const legacy = await legacyService.findById(ext.external_id);
    if (legacy?.sv_inn) {
      return res.json({ inn: { number: legacy.sv_inn } });
    }
    return res.status(404).json({ error: 'inn_not_found' });
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const inn = await innService.create(
        req.user.id,
        req.body.number,
        req.user.id
      );
      return res.status(201).json({ inn: innMapper.toPublic(inn) });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};
