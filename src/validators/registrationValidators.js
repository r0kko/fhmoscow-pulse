import { body } from 'express-validator';

import { assertPassword } from '../utils/passwordPolicy.js';

export const startRegistrationRules = [
  body('email').isEmail().withMessage('invalid_email'),
];

export const finishRegistrationRules = [
  body('email').isEmail().withMessage('invalid_email'),
  body('code').isString().notEmpty().withMessage('code_required'),
  // Enforce the same password policy used by services
  body('password')
    .isString()
    .custom((val) => {
      // Throwing within custom validator makes express-validator include our code
      try {
        assertPassword(val);
        return true;
      } catch {
        throw new Error('weak_password');
      }
    }),
];
