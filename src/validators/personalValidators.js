import { body } from 'express-validator';

import { isValidInn, isValidSnils } from '../utils/personal.js';

export const innRules = [
  body('number')
    .matches(/^\d{12}$/)
    .withMessage('invalid_format')
    .bail()
    .custom((val) => isValidInn(val))
    .withMessage('invalid_inn'),
];

export const snilsRules = [
  body('number')
    .matches(/^\d{3}-\d{3}-\d{3} \d{2}$/)
    .withMessage('invalid_format')
    .bail()
    .custom((val) => isValidSnils(val))
    .withMessage('invalid_snils'),
];
