import { body } from 'express-validator';

export const vehicleCreateRules = [
  body('vehicle').isString().trim().notEmpty().withMessage('invalid_vehicle'),
  body('number')
    .matches(/^[A-ZА-ЯЁ][0-9]{3}[A-ZА-ЯЁ]{2}[0-9]{2,3}$/i)
    .withMessage('invalid_number'),
];

export const vehicleUpdateRules = [
  body('is_active').isBoolean().withMessage('invalid_active'),
];
