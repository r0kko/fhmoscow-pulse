import { body } from 'express-validator';

export const addTeamRules = [body('team_id').isUUID()];
