import express from 'express';

import auth from '../middlewares/auth.js';
import controller from '../controllers/signTypeController.js';
import { selectSignTypeRules } from '../validators/signTypeValidators.js';

const router = express.Router();

/**
 * @swagger
 * /sign-types:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List available signature types
 *     responses:
 *       200:
 *         description: Array of sign types
 */
router.get('/', auth, controller.list);

/**
 * @swagger
 * /sign-types/me:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get current user's sign type
 *     responses:
 *       200:
 *         description: Current sign type
 */
router.get('/me', auth, controller.me);

/**
 * @swagger
 * /sign-types/select:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Select sign type for current user
 *     responses:
 *       200:
 *         description: Selected sign type
 */
router.post('/select', auth, selectSignTypeRules, controller.select);

export default router;
