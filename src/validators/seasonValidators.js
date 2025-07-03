import { body } from 'express-validator';

export const seasonCreateRules = [body('name').isString().notEmpty()];

export const seasonUpdateRules = [body('name').optional().isString().notEmpty()];
