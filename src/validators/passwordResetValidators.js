import { body } from 'express-validator';
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from '../config/auth.js';

export const passwordResetStartRules = [body('email').isEmail()];

export const passwordResetFinishRules = [
  body('email').isEmail(),
  body('code').isString().notEmpty(),
  body('password')
    .isString()
    .isLength({ min: PASSWORD_MIN_LENGTH })
    .matches(PASSWORD_PATTERN)
    .custom((val) => !['password', '123456', 'qwerty'].includes(val)),
];
