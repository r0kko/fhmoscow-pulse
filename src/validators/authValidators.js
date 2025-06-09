import { body } from 'express-validator';

/* --------------------------------------------------------------------------
 * /auth/login  – email + password
 * -------------------------------------------------------------------------*/
export const loginRules = [
    body('email')
        .isEmail().withMessage('Must be a valid email')
        .normalizeEmail(),
    body('password')
        .isString().notEmpty().withMessage('Password is required'),
];

/* --------------------------------------------------------------------------
 * /auth/refresh – refresh_token
 * -------------------------------------------------------------------------*/
export const refreshRules = [
    body('refresh_token')
        .isString().notEmpty().withMessage('refresh_token is required'),
];
