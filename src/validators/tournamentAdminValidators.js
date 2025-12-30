import { body } from 'express-validator';

export const tournamentCreateRules = [
  body('name').isString().notEmpty(),
  body('season_id').optional({ nullable: true }).isUUID(),
  body('type_id').optional({ nullable: true }).isUUID(),
  body('birth_year')
    .optional({ nullable: true })
    .isInt({ min: 1900, max: 2100 }),
  body('full_name').optional({ nullable: true }).isString(),
];

export const stageCreateRules = [
  body('tournament_id').isUUID(),
  body('name').optional({ nullable: true }).isString(),
];

export const groupCreateRules = [
  body('tournament_id').isUUID(),
  body('stage_id').isUUID(),
  body('name').optional({ nullable: true }).isString(),
  body('match_duration_minutes')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 1440 }),
];

export const groupUpdateRules = [
  body('name').optional({ nullable: true }).isString(),
  body('match_duration_minutes')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 1440 }),
];
