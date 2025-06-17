import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import userMapper from '../mappers/userMapper.js';
import admin from '../controllers/userAdminController.js';
import {
  createUserRules,
  updateUserRules,
  resetPasswordRules,
} from '../validators/userValidators.js';

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

/**
 * @swagger
 * /users/{id}/block:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Block user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated user status
 */
router.post('/:id/block', auth, authorize('ADMIN'), admin.block);

/**
 * @swagger
 * /users/{id}/unblock:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Unblock user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated user status
 */
router.post('/:id/unblock', auth, authorize('ADMIN'), admin.unblock);
router.post(
  '/:id/reset-password',
  auth,
  authorize('ADMIN'),
  resetPasswordRules,
  admin.resetPassword
);
/**
 * @swagger
 * /users/{id}/reset-password:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Reset user password
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated user password
 */
router.post(
  '/:id/roles/:roleAlias',
  auth,
  authorize('ADMIN'),
  admin.assignRole
);
/**
 * @swagger
 * /users/{id}/roles/{roleAlias}:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Assign role to user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: roleAlias
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated user roles
 */
router.delete(
  '/:id/roles/:roleAlias',
  auth,
  authorize('ADMIN'),
  admin.removeRole
);
/**
 * @swagger
 * /users/{id}/roles/{roleAlias}:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: Remove role from user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: roleAlias
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated user roles
 */

export default router;
