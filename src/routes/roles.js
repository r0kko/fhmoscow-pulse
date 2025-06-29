import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/roleController.js';

const router = express.Router();

/**
 * @swagger
 * /roles:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List available roles
 *     responses:
 *       200:
 *         description: Array of roles
 */
router.get('/', auth, authorize('ADMIN'), controller.list);

export default router;
