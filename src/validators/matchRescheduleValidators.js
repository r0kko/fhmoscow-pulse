import { body } from 'express-validator';

export const rescheduleRules = [
  body('date')
    .isISO8601()
    .withMessage('date_must_be_iso_date')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('date_must_be_yyyy_mm_dd'),
];

export default { rescheduleRules };
