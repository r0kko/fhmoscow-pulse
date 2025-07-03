import { validationResult } from 'express-validator';

import refereeGroupService from '../services/refereeGroupService.js';
import mapper from '../mappers/refereeGroupMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { page = '1', limit = '20', season_id } = req.query;
    const { rows, count } = await refereeGroupService.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      season_id,
    });
    return res.json({ groups: rows.map(mapper.toPublic), total: count });
  },

  async get(req, res) {
    try {
      const group = await refereeGroupService.getById(req.params.id);
      return res.json({ group: mapper.toPublic(group) });
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
      const group = await refereeGroupService.create(req.body, req.user.id);
      return res.status(201).json({ group: mapper.toPublic(group) });
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
      const group = await refereeGroupService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.json({ group: mapper.toPublic(group) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await refereeGroupService.remove(req.params.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
