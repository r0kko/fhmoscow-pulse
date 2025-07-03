import { body } from 'express-validator';

export const createRegistrationRules = [
  body('user_id').isUUID(),
  body('training_role_id').isUUID(),
];
