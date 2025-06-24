import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import userMapper from '../mappers/userMapper.js';
import admin from '../controllers/userAdminController.js';
import innAdmin from '../controllers/innAdminController.js';
import snilsAdmin from '../controllers/snilsAdminController.js';
import {
  createUserRules,
  updateUserRules,
  resetPasswordRules,
} from '../validators/userValidators.js';
import { innRules, snilsRules } from '../validators/personalValidators.js';

const router = express.Router();

/**
 * @swagger
 * /users/me:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get current user data
 *     responses:
 *       200:
 *         description: Current user info
 */
router.get('/me', auth, (req, res) => {
  const response = { user: userMapper.toPublic(req.user) };
  res.locals.body = response;
  res.json(response);
});

/**
 * @swagger
 * /users:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List users
 *     responses:
 *       200:
 *         description: Array of users
 */
router.get('/', auth, authorize('ADMIN'), admin.list);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get user by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User data
 */
router.get('/:id', auth, authorize('ADMIN'), admin.get);

/**
 * @swagger
 * /users:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create user
 *     responses:
 *       201:
 *         description: Created user
 */
router.post('/', auth, authorize('ADMIN'), createUserRules, admin.create);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     security:
 *       - bearerAuth: []
 *     summary: Update user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated user
 */
router.put('/:id', auth, authorize('ADMIN'), updateUserRules, admin.update);

router.post('/:id/block', auth, authorize('ADMIN'), admin.block);
router.post('/:id/unblock', auth, authorize('ADMIN'), admin.unblock);
router.post(
  '/:id/reset-password',
  auth,
  authorize('ADMIN'),
  resetPasswordRules,
  admin.resetPassword
);
router.post(
  '/:id/roles/:roleAlias',
  auth,
  authorize('ADMIN'),
  admin.assignRole
);
router.delete(
  '/:id/roles/:roleAlias',
  auth,
  authorize('ADMIN'),
  admin.removeRole
);

router.post('/:id/inn', auth, authorize('ADMIN'), innRules, innAdmin.create);
router.put('/:id/inn', auth, authorize('ADMIN'), innRules, innAdmin.update);
router.delete('/:id/inn', auth, authorize('ADMIN'), innAdmin.remove);

router.post('/:id/snils', auth, authorize('ADMIN'), snilsRules, snilsAdmin.create);
router.put('/:id/snils', auth, authorize('ADMIN'), snilsRules, snilsAdmin.update);
router.delete('/:id/snils', auth, authorize('ADMIN'), snilsAdmin.remove);

export default router;
