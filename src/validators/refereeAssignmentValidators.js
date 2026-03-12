import { body, query } from 'express-validator';

import { uuidParam } from './paramsValidators.js';

export const refereeAssignmentsListRules = [
  query('date')
    .optional({ nullable: true })
    .isString()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('invalid_date'),
  query('from')
    .optional({ nullable: true })
    .isString()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('invalid_from_date'),
  query('to')
    .optional({ nullable: true })
    .isString()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('invalid_to_date'),
  query('competition_alias')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('invalid_competition_alias'),
  query().custom((_, { req }) => {
    const date = req.query?.date;
    const from = req.query?.from;
    const to = req.query?.to;
    if (date || (from && to)) return true;
    throw new Error('date_or_range_required');
  }),
];

export const refereeAssignmentsListRefereesRules = [
  ...refereeAssignmentsListRules,
  query('role_group_id').optional({ nullable: true }).isUUID(),
  query('search').optional({ nullable: true }).isString(),
  query('require_preset_for_date')
    .optional({ nullable: true })
    .isIn(['0', '1', 'true', 'false'])
    .withMessage('invalid_require_preset_for_date'),
  query('ignore_availability_for_date')
    .optional({ nullable: true })
    .isIn(['0', '1', 'true', 'false'])
    .withMessage('invalid_ignore_availability_for_date'),
  query('only_leagues_access')
    .optional({ nullable: true })
    .isIn(['0', '1', 'true', 'false'])
    .withMessage('invalid_only_leagues_access'),
  query('role_alias')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('invalid_role_alias'),
  query('limit').optional({ nullable: true }).isInt({ min: 0, max: 10000 }),
];

export const refereeAssignmentsSelfListRules = [
  query('date')
    .isString()
    .notEmpty()
    .withMessage('date_required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('invalid_date'),
];

export const refereeAssignmentsSelfConfirmRules = [
  body('date')
    .isString()
    .notEmpty()
    .withMessage('date_required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('invalid_date'),
];

export const refereeAssignmentsSelfMatchRules = [...uuidParam('id')];

export const refereeAssignmentsUpdateRules = [
  body('assignments').isArray().withMessage('referee_assignments_required'),
  body('assignments.*.role_id').isUUID().withMessage('referee_role_not_found'),
  body('assignments.*.user_id').isUUID().withMessage('user_not_found'),
  body('role_group_id').isUUID().withMessage('referee_role_group_required'),
  body('expected_draft_version')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('invalid_draft_version'),
  body('clear_published')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('invalid_clear_flag'),
];

export const refereeAssignmentsPublishMatchRules = [
  body('allow_incomplete')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('invalid_allow_incomplete'),
];

export const refereeAssignmentsPublishDayRules = [
  body('date')
    .isString()
    .notEmpty()
    .withMessage('date_required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('invalid_date'),
  body().custom((_, { req }) => {
    const single = req.body?.role_group_id;
    const list = req.body?.role_group_ids;
    if (single) return true;
    if (Array.isArray(list) && list.length > 0) return true;
    throw new Error('referee_role_group_required');
  }),
  body('role_group_id')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('referee_role_group_required'),
  body('role_group_ids')
    .optional({ nullable: true })
    .isArray({ min: 1 })
    .withMessage('referee_role_group_required'),
  body('role_group_ids.*')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('referee_role_group_required'),
  body('allow_incomplete')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('invalid_allow_incomplete'),
];

export const refereeAssignmentsCreateSheetRules = [
  ...uuidParam('id'),
  body('signer_user_id')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('user_not_found'),
];

export const refereeAssignmentsSheetStatusRules = [...uuidParam('id')];
