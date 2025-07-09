import { validationResult } from 'express-validator';

import snilsService from '../services/snilsService.js';
import snilsMapper from '../mappers/snilsMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async get(req, res) {
    try {
      const snils = await snilsService.getByUser(req.params.id);
      if (!snils) {
        return res.status(404).json({ error: 'snils_not_found' });
      }
      return res.json({ snils: snilsMapper.toPublic(snils) });
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
      const snils = await snilsService.create(
        req.params.id,
        req.body.number,
        req.user.id
      );
      return res.status(201).json({ snils: snilsMapper.toPublic(snils) });
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
      const snils = await snilsService.update(
        req.params.id,
        req.body.number,
        req.user.id
      );
      return res.json({ snils: snilsMapper.toPublic(snils) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await snilsService.remove(req.params.id, req.user.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
