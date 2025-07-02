import { body } from 'express-validator';

export const medicalExamCreateRules = [
  body('medical_center_id').isUUID(),
  body('start_at').isISO8601(),
  body('end_at')
    .isISO8601()
    .custom((val, { req }) => new Date(val) >= new Date(req.body.start_at)),
  body('capacity').optional().isInt({ min: 0 }),
];

export const medicalExamUpdateRules = [
  body('medical_center_id').optional().isUUID(),
  body('start_at').optional().isISO8601(),
  body('end_at')
    .optional()
    .isISO8601()
    .custom((val, { req }) => {
      if (req.body.start_at) {
        return new Date(val) >= new Date(req.body.start_at);
      }
      return true;
    }),
  body('capacity').optional().isInt({ min: 0 }),
  body('status').optional().isString(),
];
