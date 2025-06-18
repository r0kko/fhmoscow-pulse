import { body } from 'express-validator';

export const confirmCodeRules = [
  body('code').isLength({ min: 6, max: 6 }).withMessage('code_required'),
];
