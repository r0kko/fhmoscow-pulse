import { body } from 'express-validator';

export const createPassportRules = [
  body('document_type').isString().notEmpty(),
  body('country').isString().notEmpty(),
  body('series')
    .if(
      (value, { req }) =>
        req.body.document_type === 'CIVIL' && req.body.country === 'RU'
    )
    .notEmpty()
    .matches(/^\d{4}$/)
    .withMessage('invalid_format'),
  body('number')
    .if(
      (value, { req }) =>
        req.body.document_type === 'CIVIL' && req.body.country === 'RU'
    )
    .notEmpty()
    .matches(/^\d{6}$/)
    .withMessage('invalid_format'),
  body('issue_date')
    .if(
      (value, { req }) =>
        req.body.document_type === 'CIVIL' && req.body.country === 'RU'
    )
    .notEmpty()
    .custom((v) => {
      const d = new Date(v);
      return !Number.isNaN(d.getTime()) && d >= new Date('2000-01-01');
    })
    .withMessage('invalid_issue_date'),
  body('valid_until').optional().isISO8601(),
  body('issuing_authority')
    .if(
      (value, { req }) =>
        req.body.document_type === 'CIVIL' && req.body.country === 'RU'
    )
    .notEmpty()
    .isString(),
  body('issuing_authority_code')
    .if(
      (value, { req }) =>
        req.body.document_type === 'CIVIL' && req.body.country === 'RU'
    )
    .notEmpty()
    .matches(/^\d{3}-\d{3}$/)
    .withMessage('invalid_format'),
  body('place_of_birth')
    .if(
      (value, { req }) =>
        req.body.document_type === 'CIVIL' && req.body.country === 'RU'
    )
    .notEmpty()
    .isString(),
];
