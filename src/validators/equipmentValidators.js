import { body } from 'express-validator';

export const equipmentCreateRules = [
  body('type_id').isUUID().withMessage('invalid_equipment_type'),
  body('manufacturer_id')
    .isUUID()
    .withMessage('invalid_equipment_manufacturer'),
  body('size_id').isUUID().withMessage('invalid_equipment_size'),
  body('number')
    .isInt({ min: 1, max: 999 })
    .withMessage('invalid_equipment_number'),
];

export const equipmentUpdateRules = [
  body('type_id').optional().isUUID().withMessage('invalid_equipment_type'),
  body('manufacturer_id')
    .optional()
    .isUUID()
    .withMessage('invalid_equipment_manufacturer'),
  body('size_id').optional().isUUID().withMessage('invalid_equipment_size'),
  body('number')
    .optional()
    .isInt({ min: 1, max: 999 })
    .withMessage('invalid_equipment_number'),
];

export const equipmentAssignRules = [
  body('user_id').isUUID().withMessage('user_not_found'),
];
