import { body } from 'express-validator';

export const createTicketRules = [
  body('description').optional().isString(),
  body('type_alias').isString().notEmpty(),
];

export const updateTicketRules = [
  body('description').optional().isString(),
  body('type_alias').optional().isString().notEmpty(),
  body('status_alias').optional().isString().notEmpty(),
];
