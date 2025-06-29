import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import userMapper from '../mappers/userMapper.js';
import admin from '../controllers/userAdminController.js';
import selfController from '../controllers/userSelfController.js';
import innAdmin from '../controllers/innAdminController.js';
import snilsAdmin from '../controllers/snilsAdminController.js';
import bankAccountAdmin from '../controllers/bankAccountAdminController.js';
import taxationAdmin from '../controllers/taxationAdminController.js';
import addressAdmin from '../controllers/addressAdminController.js';
import {
  createUserRules,
  updateUserRules,
  resetPasswordRules,
} from '../validators/userValidators.js';
import { innRules, snilsRules } from '../validators/personalValidators.js';
import { bankAccountRules } from '../validators/bankAccountValidators.js';
import { addressRules } from '../validators/addressValidators.js';
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
 * /users/me:
 *   put:
 *     security:
 *       - bearerAuth: []
 *     summary: Update current user data
 *     responses:
 *       200:
 *         description: Updated user
 */
router.put('/me', auth, updateUserRules, selfController.update);

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
 *         description: User blocked
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
 *         description: User unblocked
 */
router.post('/:id/unblock', auth, authorize('ADMIN'), admin.unblock);

/**
 * @swagger
 * /users/{id}/approve:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Approve user registration
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User approved
 */
router.post('/:id/approve', auth, authorize('ADMIN'), admin.approve);
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
 *         description: Password reset
 */
router.post(
  '/:id/reset-password',
  auth,
  authorize('ADMIN'),
  resetPasswordRules,
  admin.resetPassword
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
 *         description: Role assigned
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
 *         description: Role removed
 */
router.delete(
  '/:id/roles/:roleAlias',
  auth,
  authorize('ADMIN'),
  admin.removeRole
);

/**
 * @swagger
 * /users/{id}/inn:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Add INN for user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/:id/inn', auth, authorize('ADMIN'), innRules, innAdmin.create);
/**
 * @swagger
 * /users/{id}/inn:
 *   put:
 *     security:
 *       - bearerAuth: []
 *     summary: Update user's INN
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated
 */
router.put('/:id/inn', auth, authorize('ADMIN'), innRules, innAdmin.update);
/**
 * @swagger
 * /users/{id}/inn:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: Remove user's INN
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Removed
 */
router.delete('/:id/inn', auth, authorize('ADMIN'), innAdmin.remove);
/**
 * @swagger
 * /users/{id}/inn:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get user's INN
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: INN info
 */
router.get('/:id/inn', auth, authorize('ADMIN'), innAdmin.get);

/**
 * @swagger
 * /users/{id}/snils:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Add SNILS for user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/:id/snils',
  auth,
  authorize('ADMIN'),
  snilsRules,
  snilsAdmin.create
);
/**
 * @swagger
 * /users/{id}/snils:
 *   put:
 *     security:
 *       - bearerAuth: []
 *     summary: Update user's SNILS
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated
 */
router.put(
  '/:id/snils',
  auth,
  authorize('ADMIN'),
  snilsRules,
  snilsAdmin.update
);
/**
 * @swagger
 * /users/{id}/snils:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: Remove user's SNILS
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Removed
 */
router.delete('/:id/snils', auth, authorize('ADMIN'), snilsAdmin.remove);
/**
 * @swagger
 * /users/{id}/snils:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get user's SNILS
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: SNILS info
 */
router.get('/:id/snils', auth, authorize('ADMIN'), snilsAdmin.get);

/**
 * @swagger
 * /users/{id}/bank-account:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Add bank account for user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/:id/bank-account',
  auth,
  authorize('ADMIN'),
  bankAccountRules,
  bankAccountAdmin.create
);
/**
 * @swagger
 * /users/{id}/bank-account:
 *   put:
 *     security:
 *       - bearerAuth: []
 *     summary: Update user's bank account
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated
 */
router.put(
  '/:id/bank-account',
  auth,
  authorize('ADMIN'),
  bankAccountRules,
  bankAccountAdmin.update
);
/**
 * @swagger
 * /users/{id}/bank-account:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: Remove user's bank account
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Removed
 */
router.delete(
  '/:id/bank-account',
  auth,
  authorize('ADMIN'),
  bankAccountAdmin.remove
);
/**
 * @swagger
 * /users/{id}/bank-account:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get user's bank account
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bank account info
 */
router.get('/:id/bank-account', auth, authorize('ADMIN'), bankAccountAdmin.get);

/**
 * @swagger
 * /users/{id}/taxation:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get user's taxation info
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Taxation info
 */
router.get('/:id/taxation', auth, authorize('ADMIN'), taxationAdmin.get);
/**
 * @swagger
 * /users/{id}/taxation/check:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Validate taxation data for user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Validation result
 */
router.post(
  '/:id/taxation/check',
  auth,
  authorize('ADMIN'),
  taxationAdmin.check
);
/**
 * @swagger
 * /users/{id}/taxation:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Update user's taxation info
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated taxation
 */
router.post('/:id/taxation', auth, authorize('ADMIN'), taxationAdmin.update);

/**
 * @swagger
 * /users/{id}/passport:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Add passport for user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/:id/passport',
  auth,
  authorize('ADMIN'),
  createPassportRules,
  admin.addPassport
);
/**
 * @swagger
 * /users/{id}/passport:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get user's passport
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Passport info
 */
router.get('/:id/passport', auth, authorize('ADMIN'), admin.getPassport);
/**
 * @swagger
 * /users/{id}/passport:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: Delete user's passport
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Removed
 */
router.delete('/:id/passport', auth, authorize('ADMIN'), admin.deletePassport);

/**
 * @swagger
 * /users/{id}/address/{type}:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Add address for user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/:id/address/:type',
  auth,
  authorize('ADMIN'),
  addressRules,
  addressAdmin.create
);
/**
 * @swagger
 * /users/{id}/address/{type}:
 *   put:
 *     security:
 *       - bearerAuth: []
 *     summary: Update user's address
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated
 */
router.put(
  '/:id/address/:type',
  auth,
  authorize('ADMIN'),
  addressRules,
  addressAdmin.update
);
/**
 * @swagger
 * /users/{id}/address/{type}:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: Remove user's address
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Removed
 */
router.delete(
  '/:id/address/:type',
  auth,
  authorize('ADMIN'),
  addressAdmin.remove
);
/**
 * @swagger
 * /users/{id}/address/{type}:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get user's address
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Address info
 */
router.get('/:id/address/:type', auth, authorize('ADMIN'), addressAdmin.get);

export default router;
