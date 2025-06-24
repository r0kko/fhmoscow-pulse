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
import { createPassportRules } from '../validators/passportValidators.js';

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

router.post(
  '/:id/passport',
  auth,
  authorize('ADMIN'),
  createPassportRules,
  admin.addPassport
);
router.get('/:id/passport', auth, authorize('ADMIN'), admin.getPassport);
router.delete('/:id/passport', auth, authorize('ADMIN'), admin.deletePassport);

export default router;
