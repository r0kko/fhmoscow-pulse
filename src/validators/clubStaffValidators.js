import { body } from 'express-validator';

export const addClubStaffRules = [
  body('user_id').isString().notEmpty().withMessage('user_id_required'),
];

export default { addClubStaffRules };
