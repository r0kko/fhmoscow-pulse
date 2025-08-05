import { body } from 'express-validator';

export const normativeTicketCreateRules = [
  body('type_id').isUUID().withMessage('invalid_type_id'),
  body('value').isFloat({ min: 0 }).withMessage('invalid_value'),
  body('accepted')
    .custom((v) => v === true || v === 'true')
    .withMessage('accepted_required'),
];
