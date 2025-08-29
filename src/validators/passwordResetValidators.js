import { body } from 'express-validator';

import { assertPassword } from '../utils/passwordPolicy.js';

export const passwordResetStartRules = [body('email').isEmail()];

export const passwordResetFinishRules = [
  body('email').isEmail(),
  body('code').isString().notEmpty(),
  body('password')
    .isString()
    .custom((val) => {
      try {
        assertPassword(val);
        return true;
      } catch {
        throw new Error('weak_password');
      }
    }),
];
