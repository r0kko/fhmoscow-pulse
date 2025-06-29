import express from 'express';

import auth from '../middlewares/auth.js';
import bankAccountController from '../controllers/bankAccountController.js';
import selfController from '../controllers/bankAccountSelfController.js';
import { bankAccountRules } from '../validators/bankAccountValidators.js';

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
router.get('/me', auth, bankAccountController.me);

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
router.post('/', auth, bankAccountRules, selfController.create);

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
router.delete('/', auth, selfController.remove);

export default router;
