import { validationResult } from 'express-validator';

import normativeTypeService from '../services/normativeTypeService.js';
import mapper from '../mappers/normativeTypeMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { page = '1', limit = '20', season_id } = req.query;
    const { rows, count } = await normativeTypeService.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      season_id,
    });
    return res.json({ types: rows.map(mapper.toPublic), total: count });
  },

  async get(req, res) {
    try {
      const type = await normativeTypeService.getById(req.params.id);
      return res.json({ type: mapper.toPublic(type) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const type = await normativeTypeService.create(req.body, req.user.id);
      return res.status(201).json({ type: mapper.toPublic(type) });
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
      const type = await normativeTypeService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.json({ type: mapper.toPublic(type) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await normativeTypeService.remove(req.params.id, req.user.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
