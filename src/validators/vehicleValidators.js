import { body } from 'express-validator';

export const vehicleCreateRules = [
  body('vehicle').isString().trim().notEmpty().withMessage('invalid_vehicle'),
  body('number')
    .matches(
      /^[ABEKMHOPCTYXАВЕКМНОРСТУХ]\d{3}[ABEKMHOPCTYXАВЕКМНОРСТУХ]{2}\d{2,3}$/i
    )
    .withMessage('invalid_number'),
];

export const vehicleUpdateRules = [
  body('is_active').isBoolean().withMessage('invalid_active'),
];
