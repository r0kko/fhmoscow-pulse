import { body } from 'express-validator';

export const addGroundClubRules = [
  body('club_id').isString().notEmpty().withMessage('club_id_required'),
];

export const addGroundTeamRules = [
  body('team_id').isString().notEmpty().withMessage('team_id_required'),
];

export default { addGroundClubRules, addGroundTeamRules };
