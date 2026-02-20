import { body } from 'express-validator';

import { assertPassword } from '../utils/passwordPolicy.js';

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  } else if (digits.length === 10) {
    digits = `7${digits}`;
  }
  return digits.slice(0, 11);
}

function isValidBirthDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  if (d < new Date('1945-01-01')) return false;
  return d <= new Date();
}

export const createUserRules = [
  body('first_name').isString().trim().notEmpty(),
  body('last_name').isString().trim().notEmpty(),
  body('patronymic').optional().isString().trim(),
  body('sex_id').isUUID().withMessage('sex_required'),
  body('birth_date')
    .isISO8601()
    .custom((v) => {
      return isValidBirthDate(v);
    })
    .withMessage('invalid_birth_date'),
  body('phone')
    .customSanitizer((value) => normalizePhone(value))
    .custom((value) => /^7\d{10}$/.test(String(value || '')))
    .withMessage('invalid_phone'),
  body('email')
    .customSanitizer((value) =>
      String(value || '')
        .trim()
        .toLowerCase()
    )
    .isEmail()
    .withMessage('invalid_email'),
  // Password is generated server-side for admin-created users
  body('password')
    .optional()
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

export const updateUserRules = [
  body('first_name').optional().isString().trim().notEmpty(),
  body('last_name').optional().isString().trim().notEmpty(),
  body('patronymic').optional().isString().trim(),
  body('sex_id').optional().isUUID(),
  body('birth_date')
    .optional()
    .isISO8601()
    .custom((v) => {
      return isValidBirthDate(v);
    })
    .withMessage('invalid_birth_date'),
  body('phone')
    .optional()
    .customSanitizer((value) => normalizePhone(value))
    .custom((value) => /^7\d{10}$/.test(String(value || '')))
    .withMessage('invalid_phone'),
  body('email')
    .optional()
    .customSanitizer((value) =>
      String(value || '')
        .trim()
        .toLowerCase()
    )
    .isEmail()
    .withMessage('invalid_email'),
];

export const resetPasswordRules = [
  body('password')
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
