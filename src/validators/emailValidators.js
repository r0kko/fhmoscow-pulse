import { body } from 'express-validator';

export const confirmCodeRules = [
  body('code')
    .customSanitizer((val) =>
      String(val || '')
        .replace(/\D+/g, '')
        .slice(0, 6)
    )
    .matches(/^\d{6}$/)
    .withMessage('invalid_code'),
];
