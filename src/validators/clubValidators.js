import { body } from 'express-validator';

export const clubCreateRules = [
  body('name').isString().trim().notEmpty().withMessage('invalid_club_name'),
  body('club_type_id').optional({ nullable: true }).isUUID(),
  body('is_moscow').optional({ nullable: true }).isBoolean(),
];

export const clubUpdateRules = [
  body('name')
    .optional({ nullable: true })
    .isString()
    .trim()
    .notEmpty()
    .withMessage('invalid_club_name'),
  body('club_type_id').optional({ nullable: true }).isUUID(),
  body('is_moscow').optional({ nullable: true }).isBoolean(),
];
