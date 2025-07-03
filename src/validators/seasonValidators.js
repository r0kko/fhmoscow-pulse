import { body } from 'express-validator';

export const seasonCreateRules = [
  body('name').isString().notEmpty(),
  body('active').optional().isBoolean(),
];

export const seasonUpdateRules = [
  body('name').optional().isString().notEmpty(),
  body('active').optional().isBoolean(),
];
