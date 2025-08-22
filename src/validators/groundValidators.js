import { body } from 'express-validator';

export const groundCreateRules = [
  body('name').isString().notEmpty().withMessage('invalid_name'),
  body('address.result').optional().notEmpty().withMessage('invalid_address'),
  body('yandex_url')
    .optional()
    .isURL({ require_protocol: false })
    .withMessage('invalid_url')
    .customSanitizer((v) => {
      if (v && !/^https?:\/\//i.test(v)) {
        return `http://${v}`;
      }
      return v;
    }),
];

export const groundUpdateRules = [
  body('name').optional().isString().notEmpty().withMessage('invalid_name'),
  body('address.result').optional().notEmpty().withMessage('invalid_address'),
  body('yandex_url')
    .optional()
    .isURL({ require_protocol: false })
    .withMessage('invalid_url')
    .customSanitizer((v) => {
      if (v && !/^https?:\/\//i.test(v)) {
        return `http://${v}`;
      }
      return v;
    }),
];
