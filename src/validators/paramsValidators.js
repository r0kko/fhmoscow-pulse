import { param } from 'express-validator';

export const uuidParam = (name = 'id') => [
  param(name).isUUID().withMessage('invalid_uuid'),
];

export default { uuidParam };
