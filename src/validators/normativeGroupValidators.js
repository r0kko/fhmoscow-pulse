import { body } from 'express-validator';

export const normativeGroupCreateRules = [
  body('season_id').isUUID(),
  body('name').isString().notEmpty(),
];

export const normativeGroupUpdateRules = [
  body('name').optional().isString().notEmpty(),
];
