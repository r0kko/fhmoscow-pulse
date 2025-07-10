import { validationResult } from 'express-validator';

import taskService from '../services/taskService.js';
import taskMapper from '../mappers/taskMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const tasks = await taskService.listByUser(req.params.id);
      return res.json({ tasks: tasks.map(taskMapper.toPublic) });
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
      const task = await taskService.createForUser(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.status(201).json({ task: taskMapper.toPublic(task) });
    } catch (err) {
      return sendError(res, err, err.status === 404 ? 404 : undefined);
    }
  },

  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const task = await taskService.updateForUser(
        req.params.id,
        req.params.taskId,
        req.body,
        req.user.id
      );
      return res.json({ task: taskMapper.toPublic(task) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await taskService.removeForUser(
        req.params.id,
        req.params.taskId,
        req.user.id
      );
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
