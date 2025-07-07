import { body } from 'express-validator';

export const updateRegistrationRules = [
  body('status').isIn(['PENDING', 'APPROVED', 'CANCELED', 'COMPLETED']),
];
