import { body } from 'express-validator';

export const trainingTypeCreateRules = [
  body('name').isString().notEmpty(),
  body('alias').isString().notEmpty(),
  body('default_capacity').optional().isInt({ min: 0 }),
];

export const trainingTypeUpdateRules = [
  body('alias').optional().isString().notEmpty(),
  body('default_capacity').optional().isInt({ min: 0 }),
];
