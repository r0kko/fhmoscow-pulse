import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/refereeGroupUserAdminController.js';
import { setGroupRules } from '../validators/refereeGroupUserValidators.js';

const router = express.Router();

/**
 * @swagger
 * /referee-group-users:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List all referees with their group
 *     responses:
 *       200:
 *         description: Array of referees
 */
router.get('/', auth, authorize('ADMIN'), controller.list);

/**
 * @swagger
 * /referee-group-users/{id}:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Set referee group for user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated referee
 */
router.post(
  '/:id',
  auth,
  authorize('ADMIN'),
  setGroupRules,
  controller.setGroup
);

export default router;
