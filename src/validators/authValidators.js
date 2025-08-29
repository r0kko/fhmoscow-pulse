import { body } from 'express-validator';

/* --------------------------------------------------------------------------
 * /auth/login  – phone + password
 * -------------------------------------------------------------------------*/
export const loginRules = [
  body('phone').isMobilePhone('ru-RU').withMessage('invalid_phone').trim(),
  // Do not alter user passwords, but defensively strip zero-width codepoints
  body('password')
    .isString()
    .notEmpty()
    .withMessage('password_required')
    .customSanitizer((v) =>
      typeof v === 'string' ? v.replace(/[\u200B-\u200D\uFEFF]/g, '') : v
    ),
];

/* --------------------------------------------------------------------------
 * /auth/refresh – refresh_token
 * -------------------------------------------------------------------------*/
// Refresh now only accepts secure HTTP-only cookie; no body param
export const refreshRules = [];
