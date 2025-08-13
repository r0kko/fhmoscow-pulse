import { body } from 'express-validator';

export const createDocumentValidator = [
  body('recipientId').isUUID(),
  body('documentTypeId').isUUID(),
  body('signTypeId').isUUID(),
  body('name').isString().trim().notEmpty(),
  body('description').optional().isString(),
  body('documentDate').optional().isISO8601(),
];

export const updateDocumentValidator = [body('signTypeId').isUUID()];

export default { createDocumentValidator, updateDocumentValidator };
