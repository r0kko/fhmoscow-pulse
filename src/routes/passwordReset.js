import express from 'express';

import controller from '../controllers/passwordResetController.js';
import {
  passwordResetStartRules,
  passwordResetFinishRules,
} from '../validators/passwordResetValidators.js';
import {
  passwordResetStartEmailRateLimiter,
  passwordResetStartIpRateLimiter,
  passwordResetFinishRateLimiter,
} from '../middlewares/passwordResetRateLimiters.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

/**
 * @swagger
 * /password-reset/start:
 *   post:
 *     summary: Request password reset code (neutral response)
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
 *         description: Neutral response to avoid account enumeration
 */
router.post(
  '/start',
  passwordResetStartEmailRateLimiter,
  passwordResetStartIpRateLimiter,
  passwordResetStartRules,
  validate,
  controller.start
);

/**
 * @swagger
 * /password-reset/finish:
 *   post:
 *     summary: Reset password with 6-digit email code
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
 *                 description: 6-digit numeric code
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated
 */
router.post(
  '/finish',
  passwordResetFinishRateLimiter,
  passwordResetFinishRules,
  validate,
  controller.finish
);

export default router;
