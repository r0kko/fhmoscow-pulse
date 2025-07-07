import { body } from 'express-validator';

export const createUserRules = [
  body('first_name').isString().notEmpty(),
  body('last_name').isString().notEmpty(),
  body('sex_id').isUUID().withMessage('sex_required'),
  body('birth_date')
    .isISO8601()
    .custom((v) => {
      const d = new Date(v);
      return !Number.isNaN(d.getTime()) && d >= new Date('1945-01-01');
    })
    .withMessage('invalid_birth_date'),
  body('phone').isMobilePhone(),
  body('email').isEmail(),
  body('password').isString().notEmpty(),
];

export const updateUserRules = [
  body('first_name').optional().isString().notEmpty(),
  body('last_name').optional().isString().notEmpty(),
  body('patronymic').optional().isString(),
  body('sex_id').optional().isUUID(),
  body('birth_date')
    .optional()
    .isISO8601()
    .custom((v) => {
      const d = new Date(v);
      return !Number.isNaN(d.getTime()) && d >= new Date('1945-01-01');
    })
    .withMessage('invalid_birth_date'),
  body('phone').optional().isMobilePhone(),
  body('email').optional().isEmail(),
];

export const resetPasswordRules = [body('password').isString().notEmpty()];
