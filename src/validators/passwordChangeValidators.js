import { body } from 'express-validator';

import { assertPassword } from '../utils/passwordPolicy.js';

export const passwordChangeRules = [
  body('current_password').isString().notEmpty(),
  body('new_password')
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
