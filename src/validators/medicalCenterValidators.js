import { body } from 'express-validator';

export const medicalCenterCreateRules = [
  body('name').isString().notEmpty(),
  body('inn').isLength({ min: 10, max: 12 }).matches(/^\d+$/),
  body('address.result').notEmpty().withMessage('invalid_address'),
  body('phone')
    .optional()
    .customSanitizer((v) => v.replace(/\D/g, ''))
    .isLength({ min: 10, max: 11 })
    .matches(/^\d+$/)
    .withMessage('invalid_phone'),
  body('email').optional().isEmail(),
  body('website')
    .optional()
    .isURL({ require_protocol: false })
    .customSanitizer((v) => {
      if (v && !/^https?:\/\//i.test(v)) {
        return `http://${v}`;
      }
      return v;
    }),
];

export const medicalCenterUpdateRules = [
  body('name').optional().isString().notEmpty(),
  body('inn').optional().isLength({ min: 10, max: 12 }).matches(/^\d+$/),
  body('address.result').optional().notEmpty(),
  body('phone')
    .optional()
    .customSanitizer((v) => v.replace(/\D/g, ''))
    .isLength({ min: 10, max: 11 })
    .matches(/^\d+$/)
    .withMessage('invalid_phone'),
  body('email').optional().isEmail(),
  body('website')
    .optional()
    .isURL({ require_protocol: false })
    .customSanitizer((v) => {
      if (v && !/^https?:\/\//i.test(v)) {
        return `http://${v}`;
      }
      return v;
    }),
];
