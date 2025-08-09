import { body } from 'express-validator';

export const courseCreateRules = [
  body('name').isString().notEmpty().withMessage('invalid_name'),
  body('description').optional().isString(),
  body('responsible_id').isUUID().withMessage('invalid_responsible'),
  body('telegram_url')
    .optional()
    .isURL({ require_protocol: false })
    .withMessage('invalid_url')
    .customSanitizer((v) => {
      if (v && !/^https?:\/\//i.test(v)) {
        return `https://${v}`;
      }
      return v;
    }),
];

export const courseUpdateRules = [
  body('name').optional().isString().notEmpty().withMessage('invalid_name'),
  body('description').optional().isString(),
  body('responsible_id').optional().isUUID().withMessage('invalid_responsible'),
  body('telegram_url')
    .optional()
    .isURL({ require_protocol: false })
    .withMessage('invalid_url')
    .customSanitizer((v) => {
      if (v && !/^https?:\/\//i.test(v)) {
        return `https://${v}`;
      }
      return v;
    }),
];
