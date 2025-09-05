import { body } from 'express-validator';

import { assertPassword } from '../utils/passwordPolicy.js';

export const passwordChangeRules = [
  body('current_password').isString().notEmpty(),
  body('new_password')
    .customSanitizer((val, { req }) => {
      if (typeof val === 'string' && val.length > 0) return val;
      const b = req?.body || {};
      let s = b.password || b.pwd || b.p || null;
      if (!s && typeof b.password_b64 === 'string') {
        try {
          s = Buffer.from(b.password_b64, 'base64').toString('utf8');
        } catch (_) {
          /* ignore */
        }
      }
      return s;
    })
    .isString()
    .custom((val) => {
      try {
        assertPassword(val);
        return true;
      } catch {
        throw new Error('weak_password');
      }
    }),
];
