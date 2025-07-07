import { body } from 'express-validator';

export const updateRegistrationRules = [
  body('status').isIn(['pending', 'approved', 'canceled', 'completed']),
];
