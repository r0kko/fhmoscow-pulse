import { body } from 'express-validator';

export const trainingCreateRules = [
  body('type_id').isUUID(),
  body('season_id').optional().isUUID(),
  body('ground_id').optional().isUUID(),
  body('start_at').isISO8601(),
  body('end_at')
    .isISO8601()
    .custom((val, { req }) => new Date(val) > new Date(req.body.start_at)),
  body('capacity').optional().isInt({ min: 0 }),
  body('groups').optional().isArray(),
  body('groups.*').isUUID(),
  body('courses').optional().isArray(),
  body('courses.*').isUUID(),
];

export const trainingUpdateRules = [
  body('type_id').optional().isUUID(),
  body('season_id').optional().isUUID(),
  body('ground_id').optional().isUUID(),
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
  body('groups').optional().isArray(),
  body('groups.*').isUUID(),
  body('courses').optional().isArray(),
  body('courses.*').isUUID(),
];

export const updateAttendanceRules = [body('attendance_marked').isBoolean()];
