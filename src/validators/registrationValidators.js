import { body } from 'express-validator';

export const startRegistrationRules = [body('email').isEmail()];

export const finishRegistrationRules = [
  body('email').isEmail(),
  body('code').isString().notEmpty(),
  body('password').isString().notEmpty(),
];
