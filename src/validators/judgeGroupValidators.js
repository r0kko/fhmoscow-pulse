import { body } from 'express-validator';

export const judgeGroupCreateRules = [
  body('season_id').isUUID(),
  body('name').isString().notEmpty(),
];

export const judgeGroupUpdateRules = [
  body('season_id').optional().isUUID(),
  body('name').optional().isString().notEmpty(),
];
