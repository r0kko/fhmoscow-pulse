import { validationResult } from 'express-validator';

import innService from '../services/innService.js';
import innMapper from '../mappers/innMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async get(req, res) {
    try {
      const inn = await innService.getByUser(req.params.id);
      if (!inn) {
        return res.status(404).json({ error: 'inn_not_found' });
      }
      return res.json({ inn: innMapper.toPublic(inn) });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const inn = await innService.create(
        req.params.id,
        req.body.number,
        req.user.id
      );
      return res.status(201).json({ inn: innMapper.toPublic(inn) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const inn = await innService.update(
        req.params.id,
        req.body.number,
        req.user.id
      );
      return res.json({ inn: innMapper.toPublic(inn) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await innService.remove(req.params.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
