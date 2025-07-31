import { body } from 'express-validator';

export const normativeTicketCreateRules = [
  body('type_id').isUUID(),
  body('value').isFloat({ min: 0 }),
  body('accepted').custom((v) => v === true || v === 'true'),
];
