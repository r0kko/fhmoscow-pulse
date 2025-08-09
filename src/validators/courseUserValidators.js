import { body } from 'express-validator';

export const setCourseRules = [
  body('course_id').isUUID().withMessage('invalid_course_id'),
];
