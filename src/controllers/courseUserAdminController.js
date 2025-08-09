import { validationResult } from 'express-validator';

import courseService from '../services/courseService.js';
import userMapper from '../mappers/userMapper.js';
import courseMapper from '../mappers/courseMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const user = await courseService.getUserWithCourses(req.params.id);
      return res.json({
        user: userMapper.toPublic(user),
        courses: user.Courses.map(courseMapper.toPublic),
      });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async addCourse(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      await courseService.assignUser(
        req.body.course_id,
        req.params.id,
        req.user.id
      );
      const user = await courseService.getUserWithCourses(req.params.id);
      return res.json({
        user: userMapper.toPublic(user),
        courses: user.Courses.map(courseMapper.toPublic),
      });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async removeCourse(req, res) {
    try {
      await courseService.removeUser(
        req.params.courseId,
        req.params.id,
        req.user.id
      );
      const user = await courseService.getUserWithCourses(req.params.id);
      return res.json({
        user: userMapper.toPublic(user),
        courses: user.Courses.map(courseMapper.toPublic),
      });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
