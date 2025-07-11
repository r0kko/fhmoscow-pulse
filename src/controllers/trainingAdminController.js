import { validationResult } from 'express-validator';

import trainingService from '../services/trainingService.js';
import mapper from '../mappers/trainingMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { page = '1', limit = '20', stadium_id, group_id } = req.query;
    const { rows, count } = await trainingService.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      stadium_id,
      group_id,
    });
    return res.json({ trainings: rows.map(mapper.toPublic), total: count });
  },

  async upcoming(req, res) {
    const { page = '1', limit = '20', stadium_id, group_id } = req.query;
    const { rows, count } = await trainingService.listUpcoming({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      stadium_id,
      group_id,
    });
    return res.json({ trainings: rows.map(mapper.toPublic), total: count });
  },

  async past(req, res) {
    const { page = '1', limit = '20', stadium_id, group_id } = req.query;
    const { rows, count } = await trainingService.listPast({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      stadium_id,
      group_id,
    });
    return res.json({ trainings: rows.map(mapper.toPublic), total: count });
  },

  async get(req, res) {
    try {
      const training = await trainingService.getById(req.params.id);
      return res.json({ training: mapper.toPublic(training) });
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
      const training = await trainingService.create(req.body, req.user.id);
      return res.status(201).json({ training: mapper.toPublic(training) });
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
      const training = await trainingService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.json({ training: mapper.toPublic(training) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async setAttendance(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const training = await trainingService.setAttendanceMarked(
        req.params.id,
        req.body.attendance_marked,
        req.user.id
      );
      return res.json({ training: mapper.toPublic(training) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await trainingService.remove(req.params.id, req.user.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
