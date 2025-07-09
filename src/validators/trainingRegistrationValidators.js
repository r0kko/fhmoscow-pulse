import { body } from 'express-validator';

export const createRegistrationRules = [
  body('user_id').isUUID(),
  body('training_role_id').isUUID(),
];

export const updateRegistrationRules = [body('training_role_id').isUUID()];

export const updatePresenceRules = [
  body('present').optional({ nullable: true }).isBoolean(),
];
