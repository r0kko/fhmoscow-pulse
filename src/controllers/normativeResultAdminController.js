import { validationResult } from 'express-validator';

import normativeResultService from '../services/normativeResultService.js';
import mapper from '../mappers/normativeResultMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const {
      page = '1',
      limit = '15',
      season_id,
      search,
      type_id,
      group_id,
      user_id,
      training_id,
    } = req.query;
    const { rows, count } = await normativeResultService.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      season_id,
      search,
      type_id,
      group_id,
      user_id,
      training_id,
    });
    return res.json({ results: rows.map(mapper.toPublic), total: count });
  },

  async get(req, res) {
    try {
      const result = await normativeResultService.getById(req.params.id);
      return res.json({ result: mapper.toPublic(result) });
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
      const result = await normativeResultService.create(req.body, req.user.id);
      return res.status(201).json({ result: mapper.toPublic(result) });
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
      const result = await normativeResultService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.json({ result: mapper.toPublic(result) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await normativeResultService.remove(req.params.id, req.user.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
