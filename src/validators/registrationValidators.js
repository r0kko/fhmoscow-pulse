import { body } from 'express-validator';

import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_PATTERN,
} from '../config/auth.js';

export const startRegistrationRules = [body('email').isEmail()];

export const finishRegistrationRules = [
  body('email').isEmail(),
  body('code').isString().notEmpty(),
  body('password')
    .isString()
    .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
    .matches(PASSWORD_PATTERN)
    .custom((val) => !['password', '123456', 'qwerty'].includes(val)),
];
