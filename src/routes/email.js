import express from 'express';

import auth from '../middlewares/auth.js';
import controller from '../controllers/userEmailController.js';
import { confirmCodeRules } from '../validators/emailValidators.js';

const router = express.Router();

/**
 * @swagger
 * /email/send-code:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Send email verification code
 *     responses:
 *       200:
 *         description: Code sent
 */
router.post('/send-code', auth, controller.send);

/**
 * @swagger
 * /email/confirm:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Confirm email with code
 *     responses:
 *       200:
 *         description: Email confirmed
 */
router.post('/confirm', auth, confirmCodeRules, controller.confirm);

export default router;
