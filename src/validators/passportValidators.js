import { body } from 'express-validator';

export const createPassportRules = [
  body('document_type').isString().notEmpty(),
  body('country').isString().notEmpty(),
  body('series').optional().isString(),
  body('number').optional().isString(),
  body('issue_date').optional().isISO8601(),
  body('valid_until').optional().isISO8601(),
  body('issuing_authority').optional().isString(),
  body('issuing_authority_code').optional().isString(),
  body('place_of_birth').optional().isString(),
];
