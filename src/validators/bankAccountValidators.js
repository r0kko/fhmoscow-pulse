import { body } from 'express-validator';

import { isValidAccountNumber } from '../utils/bank.js';

export const bankAccountRules = [
  body('number')
    .matches(/^\d{20}$/)
    .withMessage('invalid_format')
    .bail()
    .custom((val, { req }) => isValidAccountNumber(val, req.body.bic))
    .withMessage('invalid_number'),
  body('bic').matches(/^\d{9}$/).withMessage('invalid_bic'),
];
