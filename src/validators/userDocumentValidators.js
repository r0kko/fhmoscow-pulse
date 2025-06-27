import { body } from 'express-validator';

export const createUserDocumentRules = [
  body('document').isString().notEmpty(),
  body('signing_date').isISO8601(),
  body('valid_until').optional().isISO8601(),
];
