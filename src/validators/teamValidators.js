import { body } from 'express-validator';

export const teamCreateRules = [
  body('club_id').isUUID(),
  body('name').isString().trim().notEmpty().withMessage('invalid_team_name'),
  body('birth_year')
    .optional({ nullable: true })
    .isInt({ min: 1900, max: 2100 })
    .withMessage('invalid_birth_year'),
];
