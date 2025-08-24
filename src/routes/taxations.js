import express from 'express';

import auth from '../middlewares/auth.js';
import taxationController from '../controllers/taxationController.js';
import denyStaffOnly from '../middlewares/denyStaffOnly.js';

const router = express.Router();

/**
 * @swagger
 * /taxations/me:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get current user's taxation info
 *     responses:
 *       200:
 *         description: Taxation details
 */
router.get('/me', auth, denyStaffOnly, taxationController.me);

/**
 * @swagger
 * /taxations/me/check:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Validate taxation data
 *     responses:
 *       200:
 *         description: Validation result
 */
router.post('/me/check', auth, denyStaffOnly, taxationController.check);

/**
 * @swagger
 * /taxations/me:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Update taxation info
 *     responses:
 *       200:
 *         description: Updated taxation
 */
router.post('/me', auth, denyStaffOnly, taxationController.update);

export default router;
