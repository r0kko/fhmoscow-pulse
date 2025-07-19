import { body } from 'express-validator';

export const normativeTypeCreateRules = [
  body('season_id').isUUID(),
  body('name').isString().notEmpty(),
  body('required').optional().isBoolean(),
  body('value_type_id').isUUID(),
  body('unit_id').isUUID(),
  body('zones').optional().isArray(),
];

export const normativeTypeUpdateRules = [
  body('name').optional().isString().notEmpty(),
  body('required').optional().isBoolean(),
  body('value_type_id').optional().isUUID(),
  body('unit_id').optional().isUUID(),
  body('zones').optional().isArray(),
];
