import express from 'express';

import userController from '../controllers/userController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users
 *     responses:
 *       200:
 *         description: Array of users
 */
router.get('/', auth, userController.list);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/:id', auth, userController.get);

export default router;
