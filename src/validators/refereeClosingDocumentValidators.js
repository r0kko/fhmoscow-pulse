import { body, query } from 'express-validator';

const closingStatusRule = /^(DRAFT|AWAITING_SIGNATURE|POSTED|CANCELED)$/;
const closingSelectionModeRule = /^(explicit|filtered)$/;

export const closingTournamentListRules = [
  query('page').optional({ nullable: true }).isInt({ min: 1, max: 100000 }),
  query('limit').optional({ nullable: true }).isInt({ min: 1, max: 500 }),
  query('search').optional({ nullable: true }).isString(),
];

export const closingProfileUpdateRules = [
  body('organization').isObject().withMessage('invalid_organizer_payload'),
];

export const closingPreviewRules = [
  body('selection_mode')
    .optional({ nullable: true })
    .isString()
    .matches(closingSelectionModeRule)
    .withMessage('invalid_closing_selection_mode'),
  body('accrual_ids')
    .optional({ nullable: true })
    .isArray({ min: 1 })
    .withMessage('closing_document_ids_required'),
  body('accrual_ids.*').optional({ nullable: true }).isUUID().withMessage('invalid_uuid'),
  body('filters').optional({ nullable: true }).isObject(),
  body('filters.search').optional({ nullable: true }).isString(),
  body('filters.status').optional({ nullable: true }).isString(),
  body('filters.date_from').optional({ nullable: true }).isISO8601(),
  body('filters.date_to').optional({ nullable: true }).isISO8601(),
  body('filters.number').optional({ nullable: true }).isString(),
  body('filters.fare_code').optional({ nullable: true }).isString(),
  body('filters.referee_role_id')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('invalid_uuid'),
  body('filters.stage_group_id')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('invalid_uuid'),
  body('filters.ground_id')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('invalid_uuid'),
  body('filters.amount_from').optional({ nullable: true }).isString(),
  body('filters.amount_to').optional({ nullable: true }).isString(),
];

export const closingListRules = [
  query('page').optional({ nullable: true }).isInt({ min: 1, max: 100000 }),
  query('limit').optional({ nullable: true }).isInt({ min: 1, max: 500 }),
  query('status')
    .optional({ nullable: true })
    .isString()
    .matches(closingStatusRule)
    .withMessage('invalid_closing_document_status'),
  query('search').optional({ nullable: true }).isString(),
];

export const closingBulkSendRules = [
  body('selection_mode')
    .optional({ nullable: true })
    .isString()
    .matches(closingSelectionModeRule)
    .withMessage('invalid_closing_selection_mode'),
  body('closing_document_ids')
    .optional({ nullable: true })
    .isArray({ min: 1 })
    .withMessage('closing_document_ids_required'),
  body('closing_document_ids.*')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('invalid_uuid'),
  body('filters').optional({ nullable: true }).isObject(),
  body('filters.status')
    .optional({ nullable: true })
    .isString()
    .matches(closingStatusRule)
    .withMessage('invalid_closing_document_status'),
  body('filters.search').optional({ nullable: true }).isString(),
];
