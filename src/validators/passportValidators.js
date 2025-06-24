import { body } from 'express-validator';

export const createPassportRules = [
  body('document_type').isString().notEmpty(),
  body('country').isString().notEmpty(),
  body('series')
    .if((value, { req }) =>
      req.body.document_type === 'CIVIL' && req.body.country === 'RU'
    )
    .notEmpty()
    .isString(),
  body('number')
    .if((value, { req }) =>
      req.body.document_type === 'CIVIL' && req.body.country === 'RU'
    )
    .notEmpty()
    .isString(),
  body('issue_date')
    .if((value, { req }) =>
      req.body.document_type === 'CIVIL' && req.body.country === 'RU'
    )
    .notEmpty()
    .isISO8601(),
  body('valid_until').optional().isISO8601(),
  body('issuing_authority')
    .if((value, { req }) =>
      req.body.document_type === 'CIVIL' && req.body.country === 'RU'
    )
    .notEmpty()
    .isString(),
  body('issuing_authority_code')
    .if((value, { req }) =>
      req.body.document_type === 'CIVIL' && req.body.country === 'RU'
    )
    .notEmpty()
    .isString(),
  body('place_of_birth').optional().isString(),
];
