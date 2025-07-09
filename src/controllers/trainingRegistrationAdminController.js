import { validationResult } from 'express-validator';

import trainingRegistrationService from '../services/trainingRegistrationService.js';
import userMapper from '../mappers/userMapper.js';
import trainingMapper from '../mappers/trainingMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { page = '1', limit = '20' } = req.query;
    try {
      const { rows, count } = await trainingRegistrationService.listByTraining(
        req.params.id,
        { page: parseInt(page, 10), limit: parseInt(limit, 10) }
      );
      const registrations = rows.map((r) => ({
        user: userMapper.toPublic(r.User),
        role: r.TrainingRole
          ? {
              id: r.TrainingRole.id,
              name: r.TrainingRole.name,
              alias: r.TrainingRole.alias,
            }
          : null,
        present: r.present,
      }));
      return res.json({ registrations, total: count });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async listForAttendance(req, res) {
    try {
      const { rows, training } =
        await trainingRegistrationService.listForAttendance(
          req.params.id,
          req.user.id
        );
      const registrations = rows.map((r) => ({
        user: userMapper.toPublic(r.User),
        role: r.TrainingRole
          ? {
              id: r.TrainingRole.id,
              name: r.TrainingRole.name,
              alias: r.TrainingRole.alias,
            }
          : null,
        present: r.present,
      }));
      return res.json({
        training: trainingMapper.toPublic(training),
        registrations,
      });
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
      await trainingRegistrationService.add(
        req.params.id,
        req.body.user_id,
        req.body.training_role_id,
        req.user.id
      );
      return res.status(201).end();
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
      await trainingRegistrationService.updateRole(
        req.params.id,
        req.params.userId,
        req.body.training_role_id,
        req.user.id
      );
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async updatePresence(req, res) {
    try {
      await trainingRegistrationService.updatePresence(
        req.params.id,
        req.params.userId,
        req.body.present,
        req.user.id
      );
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await trainingRegistrationService.remove(
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
