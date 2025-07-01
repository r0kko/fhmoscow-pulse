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
  body('parking')
    .optional()
    .isArray({ max: 1 })
    .custom((arr) => {
      if (arr.length === 0) return true;
      const p = arr[0];
      if (!p || typeof p.type !== 'string') {
        throw new Error('invalid_parking');
      }
      if (p.type === 'PAID' && (p.price === undefined || p.price === null)) {
        throw new Error('parking_price_required');
      }
      if (p.type !== 'PAID' && p.price) {
        throw new Error('parking_price_forbidden');
      }
      return true;
    }),
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
  body('parking')
    .optional()
    .isArray({ max: 1 })
    .custom((arr) => {
      if (arr.length === 0) return true;
      const p = arr[0];
      if (!p || typeof p.type !== 'string') {
        throw new Error('invalid_parking');
      }
      if (p.type === 'PAID' && (p.price === undefined || p.price === null)) {
        throw new Error('parking_price_required');
      }
      if (p.type !== 'PAID' && p.price) {
        throw new Error('parking_price_forbidden');
      }
      return true;
    }),
];
