import { validationResult } from 'express-validator';

import medicalExamRegistrationService from '../services/medicalExamRegistrationService.js';
import userMapper from '../mappers/userMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { page = '1', limit = '20', search = '' } = req.query;
    try {
      const { rows, count, approvedBefore } =
        await medicalExamRegistrationService.listByExam(req.params.id, {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          search: search.trim(),
        });
      const registrations = rows.map((r) => ({
        user: userMapper.toPublic(r.User),
        status: r.MedicalExamRegistrationStatus?.alias,
        created_at: r.createdAt ?? r.created_at,
      }));
      return res.json({
        registrations,
        total: count,
        approved_before: approvedBefore,
      });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      await medicalExamRegistrationService.setStatus(
        req.params.id,
        req.params.userId,
        req.body.status,
        req.user.id
      );
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await medicalExamRegistrationService.remove(
        req.params.id,
        req.params.userId,
        req.user.id
      );
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
