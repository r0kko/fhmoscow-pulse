import { body } from 'express-validator';

export const trainingCreateRules = [
  body('type_id').isUUID(),
  body('season_id').isUUID(),
  body('camp_stadium_id').isUUID(),
  body('start_at').isISO8601(),
  body('end_at')
    .isISO8601()
    .custom((val, { req }) => new Date(val) > new Date(req.body.start_at)),
  body('capacity').optional().isInt({ min: 0 }),
];

export const trainingUpdateRules = [
  body('type_id').optional().isUUID(),
  body('season_id').optional().isUUID(),
  body('camp_stadium_id').optional().isUUID(),
  body('start_at').optional().isISO8601(),
  body('end_at')
    .optional()
    .isISO8601()
    .custom((val, { req }) => {
      if (req.body.start_at) {
        return new Date(val) > new Date(req.body.start_at);
      }
      return true;
    }),
  body('capacity').optional().isInt({ min: 0 }),
];
