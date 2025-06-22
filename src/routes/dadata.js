import express from 'express';

import auth from '../middlewares/auth.js';
import controller from '../controllers/dadataController.js';

const router = express.Router();

/**
 * @swagger
 * /dadata/suggest-fio:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Get FIO suggestions
 *     responses:
 *       200:
 *         description: Array of suggestions
 */
router.post('/suggest-fio', auth, controller.suggestFio);

/**
 * @swagger
 * /dadata/clean-fio:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Standardize FIO
 *     responses:
 *       200:
 *         description: Standardized object
 */
router.post('/clean-fio', auth, controller.cleanFio);

export default router;
