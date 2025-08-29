import express from 'express';

import controller from '../controllers/passwordResetController.js';
import {
  passwordResetStartRules,
  passwordResetFinishRules,
} from '../validators/passwordResetValidators.js';
import passwordResetRateLimiter from '../middlewares/passwordResetRateLimiter.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

/**
 * @swagger
 * /password-reset/start:
 *   post:
 *     summary: Send password reset code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Code sent
 */
router.post(
  '/start',
  passwordResetRateLimiter,
  passwordResetStartRules,
  validate,
  controller.start
);

/**
 * @swagger
 * /password-reset/finish:
 *   post:
 *     summary: Reset password with code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated
 */
router.post(
  '/finish',
  passwordResetRateLimiter,
  passwordResetFinishRules,
  validate,
  controller.finish
);

export default router;
