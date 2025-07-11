import express from 'express';

import auth from '../middlewares/auth.js';
import controller from '../controllers/taskSelfController.js';

const router = express.Router();

/**
 * @swagger
 * /tasks:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List current user's tasks
 *     responses:
 *       200:
 *         description: Array of tasks
 */
router.get('/', auth, controller.list);

export default router;
