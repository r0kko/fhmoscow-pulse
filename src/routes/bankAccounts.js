import express from 'express';

import auth from '../middlewares/auth.js';
import bankAccountController from '../controllers/bankAccountController.js';
import selfController from '../controllers/bankAccountSelfController.js';
import { bankAccountRules } from '../validators/bankAccountValidators.js';
import denyStaffOnly from '../middlewares/denyStaffOnly.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

/**
 * @swagger
 * /bank-accounts/me:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get current user's bank account
 *     responses:
 *       200:
 *         description: Bank account info
 */
router.get('/me', auth, denyStaffOnly, bankAccountController.me);

/**
 * @swagger
 * /bank-accounts:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create bank account for current user
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/',
  auth,
  denyStaffOnly,
  bankAccountRules,
  validate,
  selfController.create
);

/**
 * @swagger
 * /bank-accounts:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: Delete current user's bank account
 *     responses:
 *       204:
 *         description: Removed
 */
router.delete('/', auth, denyStaffOnly, selfController.remove);

/**
 * @swagger
 * /bank-accounts/change-request:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Request bank details change (creates ticket + statement)
 *     responses:
 *       201:
 *         description: Created ticket and document
 */
router.post(
  '/change-request',
  auth,
  denyStaffOnly,
  bankAccountRules,
  validate,
  selfController.requestChange
);

export default router;
