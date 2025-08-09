import { body } from 'express-validator';

export const assignCourseRules = [
  body('course_id').isUUID().withMessage('invalid_course_id'),
];
