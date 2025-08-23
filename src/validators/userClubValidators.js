import { body } from 'express-validator';

export const addClubRules = [body('club_id').isUUID()];
