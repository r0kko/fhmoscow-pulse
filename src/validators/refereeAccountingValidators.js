import { body, query } from 'express-validator';

import { uuidParam } from './paramsValidators.js';

const fareCodeRule = /^[A-Za-z][A-Za-z0-9]{1,7}$/;
const aliasRule = /^[A-Za-z_][A-Za-z0-9_]{1,31}$/;

function isRubAmountText(raw) {
  let text = String(raw || '').trim();
  if (!text) return false;
  if (text.startsWith('-')) text = text.slice(1);
  if (!text) return false;

  let separatorIndex = -1;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '.' || char === ',') {
      if (separatorIndex !== -1) return false;
      separatorIndex = i;
      continue;
    }
    if (char < '0' || char > '9') return false;
  }

  if (separatorIndex === -1) return true;
  const integerPart = text.slice(0, separatorIndex);
  const fractionPart = text.slice(separatorIndex + 1);
  if (!integerPart || !fractionPart) return false;
  return fractionPart.length <= 2;
}

const optionalDateRule = (fieldName, invalidCode) =>
  body(fieldName)
    .optional({ nullable: true })
    .isString()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage(invalidCode);

const optionalQueryDateRule = (fieldName, invalidCode) =>
  query(fieldName)
    .optional({ nullable: true })
    .isString()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage(invalidCode);

const rubAmountBodyRule = (fieldName, invalidCode) =>
  body(fieldName)
    .custom((value) => {
      const text = String(value ?? '').trim();
      if (!isRubAmountText(text)) {
        throw new Error(invalidCode);
      }
      return true;
    })
    .withMessage(invalidCode);

const optionalRubAmountBodyRule = (fieldName, invalidCode) =>
  body(fieldName)
    .optional({ nullable: true })
    .custom((value) => {
      const text = String(value ?? '').trim();
      if (!isRubAmountText(text)) {
        throw new Error(invalidCode);
      }
      return true;
    })
    .withMessage(invalidCode);

const optionalRubAmountQueryRule = (fieldName, invalidCode) =>
  query(fieldName)
    .optional({ nullable: true })
    .custom((value) => {
      const text = String(value ?? '').trim();
      if (!isRubAmountText(text)) {
        throw new Error(invalidCode);
      }
      return true;
    })
    .withMessage(invalidCode);

export const tariffListRules = [
  query('page').optional({ nullable: true }).isInt({ min: 1, max: 100000 }),
  query('limit').optional({ nullable: true }).isInt({ min: 1, max: 5000 }),
  query('fare_code')
    .optional({ nullable: true })
    .isString()
    .matches(fareCodeRule)
    .withMessage('invalid_fare_code'),
  query('stage_group_id').optional({ nullable: true }).isUUID(),
  query('referee_role_id').optional({ nullable: true }).isUUID(),
  optionalQueryDateRule('on_date', 'invalid_on_date'),
  query('status')
    .optional({ nullable: true })
    .isString()
    .matches(aliasRule)
    .withMessage('invalid_tariff_status'),
];

export const paymentsDashboardRules = [
  optionalQueryDateRule('on_date', 'invalid_on_date'),
];

export const tariffCreateRules = [
  body('stage_group_id').isUUID(),
  body('referee_role_id').isUUID(),
  body('fare_code')
    .isString()
    .matches(fareCodeRule)
    .withMessage('invalid_fare_code'),
  rubAmountBodyRule('base_amount_rub', 'invalid_base_amount'),
  rubAmountBodyRule('meal_amount_rub', 'invalid_meal_amount'),
  body('valid_from')
    .isString()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('invalid_valid_from'),
  optionalDateRule('valid_to', 'invalid_valid_to'),
  body('status')
    .optional({ nullable: true })
    .isString()
    .matches(aliasRule)
    .withMessage('invalid_tariff_status'),
];

export const tariffUpdateRules = [
  body('stage_group_id').optional({ nullable: true }).isUUID(),
  body('referee_role_id').optional({ nullable: true }).isUUID(),
  body('fare_code')
    .optional({ nullable: true })
    .isString()
    .matches(fareCodeRule)
    .withMessage('invalid_fare_code'),
  optionalRubAmountBodyRule('base_amount_rub', 'invalid_base_amount'),
  optionalRubAmountBodyRule('meal_amount_rub', 'invalid_meal_amount'),
  optionalDateRule('valid_from', 'invalid_valid_from'),
  optionalDateRule('valid_to', 'invalid_valid_to'),
  body('status')
    .optional({ nullable: true })
    .isString()
    .matches(aliasRule)
    .withMessage('invalid_tariff_status'),
  body().custom((payload) => {
    const keys = [
      'stage_group_id',
      'referee_role_id',
      'fare_code',
      'base_amount_rub',
      'meal_amount_rub',
      'valid_from',
      'valid_to',
      'status',
    ];
    if (!keys.some((key) => Object.hasOwn(payload || {}, key))) {
      throw new Error('tariff_update_payload_required');
    }
    return true;
  }),
];

export const travelRateListRules = [
  query('page').optional({ nullable: true }).isInt({ min: 1, max: 100000 }),
  query('limit').optional({ nullable: true }).isInt({ min: 1, max: 1000 }),
  query('status')
    .optional({ nullable: true })
    .isString()
    .matches(aliasRule)
    .withMessage('invalid_travel_rate_status'),
  optionalQueryDateRule('on_date', 'invalid_on_date'),
];

export const travelRateCreateRules = [
  body('rate_code').optional({ nullable: true }).isString(),
  rubAmountBodyRule('travel_amount_rub', 'invalid_travel_amount'),
  body('valid_from')
    .isString()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('invalid_valid_from'),
  optionalDateRule('valid_to', 'invalid_valid_to'),
  body('status')
    .optional({ nullable: true })
    .isString()
    .matches(aliasRule)
    .withMessage('invalid_travel_rate_status'),
];

export const travelRateUpdateRules = [
  body('rate_code').optional({ nullable: true }).isString(),
  optionalRubAmountBodyRule('travel_amount_rub', 'invalid_travel_amount'),
  optionalDateRule('valid_from', 'invalid_valid_from'),
  optionalDateRule('valid_to', 'invalid_valid_to'),
  body('status')
    .optional({ nullable: true })
    .isString()
    .matches(aliasRule)
    .withMessage('invalid_travel_rate_status'),
  body().custom((payload) => {
    const keys = [
      'rate_code',
      'travel_amount_rub',
      'valid_from',
      'valid_to',
      'status',
    ];
    if (!keys.some((key) => Object.hasOwn(payload || {}, key))) {
      throw new Error('travel_rate_update_payload_required');
    }
    return true;
  }),
];

export const accrualGenerateRules = [
  optionalDateRule('from_date', 'invalid_from_date'),
  optionalDateRule('to_date', 'invalid_to_date'),
  body('apply')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('invalid_apply_flag'),
];

export const accrualListRules = [
  query('page').optional({ nullable: true }).isInt({ min: 1, max: 100000 }),
  query('limit').optional({ nullable: true }).isInt({ min: 1, max: 1000 }),
  query('tournament_id').optional({ nullable: true }).isUUID(),
  query('status')
    .optional({ nullable: true })
    .isString()
    .matches(aliasRule)
    .withMessage('invalid_accrual_status'),
  query('source')
    .optional({ nullable: true })
    .isString()
    .matches(aliasRule)
    .withMessage('invalid_accrual_source'),
  query('number').optional({ nullable: true }).isString(),
  query('fare_code')
    .optional({ nullable: true })
    .isString()
    .matches(fareCodeRule)
    .withMessage('invalid_fare_code'),
  query('referee_role_id').optional({ nullable: true }).isUUID(),
  query('stage_group_id').optional({ nullable: true }).isUUID(),
  query('ground_id').optional({ nullable: true }).isUUID(),
  optionalQueryDateRule('date_from', 'invalid_date_from'),
  optionalQueryDateRule('date_to', 'invalid_date_to'),
  optionalRubAmountQueryRule('amount_from', 'invalid_amount_from'),
  optionalRubAmountQueryRule('amount_to', 'invalid_amount_to'),
  query('search').optional({ nullable: true }).isString(),
];

export const paymentRegistryListRules = [
  query('page').optional({ nullable: true }).isInt({ min: 1, max: 100000 }),
  query('limit').optional({ nullable: true }).isInt({ min: 1, max: 1000 }),
  optionalQueryDateRule('date_from', 'invalid_date_from'),
  optionalQueryDateRule('date_to', 'invalid_date_to'),
  query('taxation_type_alias')
    .optional({ nullable: true })
    .isString()
    .matches(aliasRule)
    .withMessage('invalid_taxation_type_alias'),
];

export const accrualActionRules = [
  body('action_alias')
    .isString()
    .matches(aliasRule)
    .withMessage('invalid_accrual_action'),
  body('comment')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 1000 }),
];

export const accrualBulkActionRules = [
  body('action_alias')
    .isString()
    .matches(aliasRule)
    .withMessage('invalid_accrual_action'),
  body('ids').isArray({ min: 1 }).withMessage('bulk_ids_required'),
  body('ids.*').isUUID().withMessage('bulk_ids_invalid'),
  body('comment')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 1000 }),
];

export const accrualAdjustmentRules = [
  optionalRubAmountBodyRule('base_amount_rub', 'invalid_base_amount'),
  optionalRubAmountBodyRule('meal_amount_rub', 'invalid_meal_amount'),
  optionalRubAmountBodyRule('travel_amount_rub', 'invalid_travel_amount'),
  body('reason_code')
    .isString()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('reason_code_required'),
  body('comment')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 1000 }),
];

export const accrualDeleteRules = [
  body('reason_code')
    .isString()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('reason_code_required'),
  body('comment')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 1000 }),
];

export const accrualBulkDeleteRules = [
  body('ids').isArray({ min: 1 }).withMessage('bulk_ids_required'),
  body('ids.*').isUUID().withMessage('bulk_ids_invalid'),
  body('reason_code')
    .isString()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('reason_code_required'),
  body('comment')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 1000 }),
];

export const accrualIdRules = [...uuidParam('id')];

export default {
  tariffListRules,
  paymentsDashboardRules,
  tariffCreateRules,
  tariffUpdateRules,
  travelRateListRules,
  travelRateCreateRules,
  travelRateUpdateRules,
  accrualGenerateRules,
  accrualListRules,
  accrualActionRules,
  accrualBulkActionRules,
  accrualAdjustmentRules,
  accrualDeleteRules,
  accrualBulkDeleteRules,
  accrualIdRules,
};
