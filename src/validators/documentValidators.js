import { body } from 'express-validator';

export const createDocumentValidator = [
  body('recipientId').isUUID(),
  body('documentTypeId').isUUID(),
  body('fileId').isUUID(),
  body('signTypeId').isUUID(),
  body('name').isString().trim().notEmpty(),
  body('description').optional().isString(),
];

export default { createDocumentValidator };
