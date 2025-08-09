import { body } from 'express-validator';

export const selectSignTypeRules = [
  body('alias').isString().notEmpty().withMessage('alias_required'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('code_required'),
];
