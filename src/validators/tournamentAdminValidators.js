import { body } from 'express-validator';

import {
  MATCH_FORMAT_VALUES,
  REFEREE_PAYMENT_VALUES,
} from '../utils/tournamentSettings.js';

const optionValidator = (allowedSet, errorCode) => (value) => {
  if (value === '' || value == null) return true;
  if (!allowedSet.has(String(value))) {
    throw new Error(errorCode);
  }
  return true;
};

export const tournamentCreateRules = [
  body('name').isString().notEmpty(),
  body('season_id').optional({ nullable: true }).isUUID(),
  body('type_id').optional({ nullable: true }).isUUID(),
  body('competition_type_id').optional({ nullable: true }).isUUID(),
  body('schedule_management_type_id').isUUID(),
  body('birth_year')
    .optional({ nullable: true })
    .isInt({ min: 1900, max: 2100 }),
  body('full_name').optional({ nullable: true }).isString(),
  body('match_format')
    .optional({ nullable: true })
    .custom(optionValidator(MATCH_FORMAT_VALUES, 'invalid_match_format')),
  body('referee_payment_type')
    .optional({ nullable: true })
    .custom(
      optionValidator(REFEREE_PAYMENT_VALUES, 'invalid_referee_payment_type')
    ),
];

export const tournamentUpdateRules = [
  body('competition_type_id').optional({ nullable: true }).isUUID(),
  body('schedule_management_type_id').optional({ nullable: true }).isUUID(),
  body('match_format')
    .optional({ nullable: true })
    .custom(optionValidator(MATCH_FORMAT_VALUES, 'invalid_match_format')),
  body('referee_payment_type')
    .optional({ nullable: true })
    .custom(
      optionValidator(REFEREE_PAYMENT_VALUES, 'invalid_referee_payment_type')
    ),
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

export const groupRefereesUpdateRules = [
  body('roles').isArray().withMessage('referee_roles_required'),
  body('roles').custom((arr) => {
    const seen = new Set();
    for (const item of arr) {
      if (!item || typeof item.role_id !== 'string' || !item.role_id) {
        throw new Error('referee_role_not_found');
      }
      if (seen.has(item.role_id)) {
        throw new Error('referee_roles_duplicate');
      }
      seen.add(item.role_id);
      const count = Number(item.count);
      if (!Number.isFinite(count) || count < 0 || count > 2) {
        throw new Error('invalid_referee_count');
      }
    }
    return true;
  }),
];
