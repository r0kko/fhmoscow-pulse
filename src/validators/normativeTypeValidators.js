import { body } from 'express-validator';

export const normativeTypeCreateRules = [
  body('season_id').isUUID(),
  body('name').isString().notEmpty(),
  body('required').optional().isBoolean(),
  body('value_type_id').isUUID(),
  body('unit_id').isUUID(),
  body('zones').isArray({ min: 1 }),
  body('zones.*.zone_id').isUUID(),
  body('zones.*.sex_id').isUUID(),
  body('groups').isArray({ min: 1, max: 1 }),
  body('groups.*.group_id').isUUID(),
  body('groups.*.required').optional().isBoolean(),
];

export const normativeTypeUpdateRules = [
  body('name').optional().isString().notEmpty(),
  body('required').optional().isBoolean(),
  body('value_type_id').optional().isUUID(),
  body('unit_id').optional().isUUID(),
  body('zones').optional().isArray({ min: 1 }),
  body('zones.*.zone_id').optional().isUUID(),
  body('zones.*.sex_id').optional().isUUID(),
  body('groups').optional().isArray({ min: 1, max: 1 }),
  body('groups.*.group_id').optional().isUUID(),
  body('groups.*.required').optional().isBoolean(),
];
