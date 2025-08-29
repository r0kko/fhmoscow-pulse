import { body } from 'express-validator';

export const createAgreementRules = [
  body('ground_id').isString().notEmpty().withMessage('ground_id_required'),
  body('date_start').isISO8601().withMessage('date_start_must_be_iso_datetime'),
  body('parent_id').optional({ nullable: true }).isString(),
];

export default { createAgreementRules };
