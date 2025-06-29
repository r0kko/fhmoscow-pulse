import { body } from 'express-validator';

export const medicalCertificateRules = [
  body('inn').matches(/^\d{10,12}$/).withMessage('invalid_format'),
  body('organization').isString().notEmpty(),
  body('certificate_number').isString().notEmpty(),
  body('issue_date').isISO8601(),
  body('valid_until').isISO8601(),
];
