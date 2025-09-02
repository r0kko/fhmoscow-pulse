import { body } from 'express-validator';

export const adminSetScheduleRules = [
  body('date_start')
    .isISO8601()
    .withMessage('date_start_must_be_iso_datetime')
    .notEmpty(),
  body('ground_id').isUUID().withMessage('ground_id_must_be_uuid'),
];

export default { adminSetScheduleRules };
