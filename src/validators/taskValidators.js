import { body } from 'express-validator';

export const createTaskRules = [
  body('title').isString().notEmpty(),
  body('description').optional().isString(),
  body('type_alias').isString().notEmpty(),
];

export const updateTaskRules = [
  body('title').optional().isString().notEmpty(),
  body('description').optional().isString(),
  body('type_alias').optional().isString().notEmpty(),
  body('status_alias').optional().isString().notEmpty(),
];
