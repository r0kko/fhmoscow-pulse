import express from 'express';

import authController from '../controllers/authController.js';
import auth from '../middlewares/auth.js';
import { loginRules, refreshRules } from '../validators/authValidators.js';

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
router.post('/login', loginRules, authController.login);

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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token
 */
router.post('/refresh', refreshRules, authController.refresh);

export default router;
