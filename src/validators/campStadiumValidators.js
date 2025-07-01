import { body } from 'express-validator';

export const campStadiumCreateRules = [
  body('name').isString().notEmpty(),
  body('address.result').notEmpty().withMessage('invalid_address'),
  body('yandex_url').optional().isURL(),
  body('capacity').optional().isInt({ min: 0 }),
  body('phone')
    .optional()
    .customSanitizer((v) => v.replace(/\D/g, ''))
    .isMobilePhone('ru-RU'),
  body('website')
    .optional()
    .isURL({ require_protocol: false })
    .customSanitizer((v) => {
      if (v && !/^https?:\/\//i.test(v)) {
        return `http://${v}`;
      }
      return v;
    }),
  body('parking').optional().isArray(),
];

export const campStadiumUpdateRules = [
  body('name').optional().isString().notEmpty(),
  body('address.result').optional().notEmpty(),
  body('yandex_url').optional().isURL(),
  body('capacity').optional().isInt({ min: 0 }),
  body('phone')
    .optional()
    .customSanitizer((v) => v.replace(/\D/g, ''))
    .isMobilePhone('ru-RU'),
  body('website')
    .optional()
    .isURL({ require_protocol: false })
    .customSanitizer((v) => {
      if (v && !/^https?:\/\//i.test(v)) {
        return `http://${v}`;
      }
      return v;
    }),
  body('parking').optional().isArray(),
];
