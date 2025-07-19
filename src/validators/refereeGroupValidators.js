import { body } from 'express-validator';

export const refereeGroupCreateRules = [
  body('season_id').isUUID(),
  body('name').isString().notEmpty(),
];

export const refereeGroupUpdateRules = [
  body('season_id').optional().isUUID(),
  body('name').optional().isString().notEmpty(),
];
