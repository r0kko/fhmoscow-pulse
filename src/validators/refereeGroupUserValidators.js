import { body } from 'express-validator';

export const setGroupRules = [body('group_id').isUUID()];
