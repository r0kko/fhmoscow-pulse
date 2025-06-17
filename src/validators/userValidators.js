import { body } from 'express-validator';

export const createUserRules = [
  body('first_name').isString().notEmpty(),
  body('last_name').isString().notEmpty(),
  body('birth_date').isISO8601(),
  body('phone').isMobilePhone(),
  body('email').isEmail(),
  body('password').isString().notEmpty(),
];

export const updateUserRules = [
  body('first_name').optional().isString().notEmpty(),
  body('last_name').optional().isString().notEmpty(),
  body('patronymic').optional().isString(),
  body('birth_date').optional().isISO8601(),
  body('phone').optional().isMobilePhone(),
  body('email').optional().isEmail(),
];

export const resetPasswordRules = [body('password').isString().notEmpty()];
