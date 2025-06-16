import { body } from 'express-validator';

/* --------------------------------------------------------------------------
 * /auth/login  – phone + password
 * -------------------------------------------------------------------------*/
export const loginRules = [
  body('phone')
    .isMobilePhone()
    .withMessage('Must be a valid phone number')
    .trim(),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

/* --------------------------------------------------------------------------
 * /auth/refresh – refresh_token
 * -------------------------------------------------------------------------*/
export const refreshRules = [
  body('refresh_token')
    .isString()
    .notEmpty()
    .withMessage('refresh_token is required'),
];
