import { body } from 'express-validator';

const positionIdOptionalRule = body('position_id')
  .optional({ nullable: true })
  .custom((value) => value === null || typeof value === 'string')
  .withMessage('position_id_invalid');

export const addClubStaffRules = [
  body('user_id').isString().notEmpty().withMessage('user_id_required'),
  positionIdOptionalRule,
];

export const updateClubStaffPositionRules = [
  body('position_id')
    .exists()
    .withMessage('position_id_required')
    .bail()
    .custom((value) => value === null || typeof value === 'string')
    .withMessage('position_id_invalid'),
];

export default { addClubStaffRules, updateClubStaffPositionRules };
