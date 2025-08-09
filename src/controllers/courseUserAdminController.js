import { validationResult } from 'express-validator';

import courseService from '../services/courseService.js';
import userMapper from '../mappers/userMapper.js';
import courseMapper from '../mappers/courseMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const { user, course } = await courseService.getUserWithCourse(
        req.params.id
      );
      return res.json({
        user: userMapper.toPublic(user),
        course: courseMapper.toPublic(course),
      });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async setCourse(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      await courseService.setUserCourse(
        req.params.id,
        req.body.course_id,
        req.user.id
      );
      const { user, course } = await courseService.getUserWithCourse(
        req.params.id
      );
      return res.json({
        user: userMapper.toPublic(user),
        course: courseMapper.toPublic(course),
      });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async clearCourse(req, res) {
    try {
      await courseService.removeUser(req.params.id, req.user.id);
      const { user } = await courseService.getUserWithCourse(req.params.id);
      return res.json({
        user: userMapper.toPublic(user),
        course: null,
      });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
