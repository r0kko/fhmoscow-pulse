import { body } from 'express-validator';

export const normativeResultCreateRules = [
  body('user_id').isUUID(),
  body('season_id').isUUID(),
  body('training_id').optional().isUUID(),
  body('type_id').isUUID(),
  body('value_type_id').isUUID(),
  body('unit_id').isUUID(),
  body('value').isFloat(),
];

export const normativeResultUpdateRules = [
  body('training_id').optional().isUUID(),
  body('value').optional().isFloat(),
];

export const normativeResultSelfCreateRules = [
  body('season_id').isUUID(),
  body('training_id').optional().isUUID(),
  body('type_id').isUUID(),
  body('value_type_id').isUUID(),
  body('unit_id').isUUID(),
  body('value').isFloat(),
];

export const normativeResultSelfUpdateRules = [
  body('training_id').optional().isUUID(),
  body('value').optional().isFloat(),
];
