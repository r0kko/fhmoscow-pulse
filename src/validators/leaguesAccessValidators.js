import { body, query } from 'express-validator';

import { uuidParam } from './paramsValidators.js';

const competitionAliasQuery = query('competition_alias')
  .optional({ nullable: true })
  .isString()
  .trim()
  .isLength({ min: 1, max: 64 })
  .withMessage('invalid_competition_alias');

const seasonIdQuery = query('season_id')
  .optional({ nullable: true })
  .isUUID()
  .withMessage('invalid_season_id');

const competitionTypeIdQuery = query('competition_type_id')
  .optional({ nullable: true })
  .isUUID()
  .withMessage('invalid_competition_type_id');

const seasonModeQuery = query('season_mode')
  .optional({ nullable: true })
  .isIn(['current'])
  .withMessage('invalid_season_mode');

export const leaguesAccessListRules = [
  competitionAliasQuery,
  seasonIdQuery,
  competitionTypeIdQuery,
  seasonModeQuery,
  query('search').optional({ nullable: true }).isString(),
];

export const leaguesAccessGrantRules = [
  body('user_id').isUUID().withMessage('invalid_user_id'),
  body('season_id')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('invalid_season_id'),
  body('competition_type_id')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('invalid_competition_type_id'),
  body('competition_alias')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('invalid_competition_alias'),
  body('season_mode')
    .optional({ nullable: true })
    .isIn(['current'])
    .withMessage('invalid_season_mode'),
];

export const leaguesAccessRevokeRules = [...uuidParam('id')];
