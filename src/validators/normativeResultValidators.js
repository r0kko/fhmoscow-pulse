import { body } from 'express-validator';

import { NormativeType, MeasurementUnit } from '../models/index.js';
import { parseResultValue } from '../services/normativeTypeService.js';

export const normativeResultCreateRules = [
  body('user_id').isUUID(),
  body('season_id').isUUID(),
  body('training_id').optional().isUUID(),
  body('type_id').isUUID(),
  body('online').optional().isBoolean(),
  body('retake').optional().isBoolean(),
  body().custom((_, { req }) => {
    if (req.body.online && req.body.retake) {
      throw new Error('online_retake_conflict');
    }
    return true;
  }),
  body('value')
    .notEmpty()
    .custom(async (val, { req }) => {
      const type = await NormativeType.findByPk(req.body.type_id, {
        include: [MeasurementUnit],
      });
      if (!type) throw new Error('normative_type_not_found');
      const parsed = parseResultValue(val, type.MeasurementUnit);
      if (parsed == null) throw new Error('invalid_value');
      req.body.value = parsed;
      req.body.unit_id = type.unit_id;
      req.body.value_type_id = type.value_type_id;
      return true;
    }),
];

export const normativeResultUpdateRules = [
  body('training_id').optional().isUUID(),
  body('value').optional().notEmpty(),
  body('online').optional().isBoolean(),
  body('retake').optional().isBoolean(),
  body().custom((_, { req }) => {
    if (req.body.online && req.body.retake) {
      throw new Error('online_retake_conflict');
    }
    return true;
  }),
];
