import { body, query } from 'express-validator';

import { uuidParam } from './paramsValidators.js';

export const refereeAssignmentsListRules = [
  query('date')
    .isString()
    .notEmpty()
    .withMessage('date_required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('invalid_date'),
];

export const refereeAssignmentsListRefereesRules = [
  ...refereeAssignmentsListRules,
  query('role_group_id').optional({ nullable: true }).isUUID(),
  query('search').optional({ nullable: true }).isString(),
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
  body('clear_published')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('invalid_clear_flag'),
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
];
