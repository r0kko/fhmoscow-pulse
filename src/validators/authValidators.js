import { body } from 'express-validator';

/* --------------------------------------------------------------------------
 * /auth/login  – phone + password
 * -------------------------------------------------------------------------*/
export const loginRules = [
  body('phone')
    .isMobilePhone('ru-RU')
    .withMessage('Must be a valid Russian phone number')
    .trim(),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

/* --------------------------------------------------------------------------
 * /auth/refresh – refresh_token
 * -------------------------------------------------------------------------*/
export const refreshRules = [
  body('refresh_token').optional().isString().notEmpty(),
];
