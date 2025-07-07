import { body } from 'express-validator';

export const updateRegistrationRules = [body('approved').isBoolean()];
