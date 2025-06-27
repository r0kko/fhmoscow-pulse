import { body } from 'express-validator';

export const addressRules = [
  body('result').notEmpty().withMessage('invalid_address'),
];
