import { body } from 'express-validator';

export const addTeamStaffRules = [
  body('user_id').isString().notEmpty().withMessage('user_id_required'),
];

export default { addTeamStaffRules };
