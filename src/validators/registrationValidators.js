import { body } from 'express-validator';

export const startRegistrationRules = [body('email').isEmail()];

export const finishRegistrationRules = [
  body('email').isEmail(),
  body('code').isString().notEmpty(),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .matches(/[a-z]/i)
    .matches(/[0-9]/)
    .custom((val) => !['password', '123456', 'qwerty'].includes(val)),
];
