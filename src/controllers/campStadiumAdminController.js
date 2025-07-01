import { validationResult } from 'express-validator';

import campStadiumService from '../services/campStadiumService.js';
import mapper from '../mappers/campStadiumMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { page = '1', limit = '20' } = req.query;
    const { rows, count } = await campStadiumService.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    return res.json({ stadiums: rows.map(mapper.toPublic), total: count });
  },

  async get(req, res) {
    try {
      const stadium = await campStadiumService.getById(req.params.id);
      return res.json({ stadium: mapper.toPublic(stadium) });
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
      const stadium = await campStadiumService.create(req.body, req.user.id);
      return res.status(201).json({ stadium: mapper.toPublic(stadium) });
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
      const stadium = await campStadiumService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.json({ stadium: mapper.toPublic(stadium) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await campStadiumService.remove(req.params.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async parkingTypes(_req, res) {
    const types = await campStadiumService.listParkingTypes();
    return res.json({
      parkingTypes: types.map((t) => ({
        id: t.id,
        name: t.name,
        alias: t.alias,
      })),
    });
  },
};
