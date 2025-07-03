import { validationResult } from 'express-validator';

import medicalExamService from '../services/medicalExamService.js';
import mapper from '../mappers/medicalExamMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { page = '1', limit = '20' } = req.query;
    const { rows, count } = await medicalExamService.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    return res.json({ exams: rows.map(mapper.toPublic), total: count });
  },

  async get(req, res) {
    try {
      const exam = await medicalExamService.getById(req.params.id);
      return res.json({ exam: mapper.toPublic(exam) });
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
      const exam = await medicalExamService.create(req.body, req.user.id);
      return res.status(201).json({ exam: mapper.toPublic(exam) });
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
      const exam = await medicalExamService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.json({ exam: mapper.toPublic(exam) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await medicalExamService.remove(req.params.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async statuses(_req, res) {
    const statuses = await medicalExamService.listStatuses();
    return res.json({
      statuses: statuses.map((s) => ({
        id: s.id,
        name: s.name,
        alias: s.alias,
      })),
    });
  },
};
