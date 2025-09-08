import express from 'express';

import authController from '../controllers/authController.js';
import auth from '../middlewares/auth.js';
import { loginRules, refreshRules } from '../validators/authValidators.js';
import validate from '../middlewares/validate.js';
import passwordChangeController from '../controllers/passwordChangeController.js';
import { passwordChangeRules } from '../validators/passwordChangeValidators.js';
import loginRateLimiter from '../middlewares/loginRateLimiter.js';
import passwordPolicyController from '../controllers/passwordPolicyController.js';

const router = express.Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in a user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful login
 */
router.post(
  '/login',
  loginRateLimiter,
  loginRules,
  validate,
  authController.login
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Log out the current user
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post('/logout', auth, authController.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get current user info
 *     responses:
 *       200:
 *         description: Current user info
 */
router.get('/me', auth, authController.me);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     responses:
 *       200:
 *         description: New access token. Requires a valid HTTP-only refresh cookie.
 */
router.post('/refresh', refreshRules, validate, authController.refresh);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Change current user's password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - current_password
 *               - new_password
 *             properties:
 *               current_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed and new tokens issued
 */
router.post(
  '/change-password',
  auth,
  passwordChangeRules,
  validate,
  passwordChangeController.changeSelf
);

/**
 * @swagger
 * /auth/password-policy:
 *   get:
 *     summary: Get current password policy metadata
 *     responses:
 *       200:
 *         description: Policy info
 */
router.get('/password-policy', passwordPolicyController.get);

export default router;
