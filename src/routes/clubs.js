import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/clubController.js';
import accessScope from '../middlewares/accessScope.js';
import clubStaffController from '../controllers/clubStaffController.js';
import { addClubStaffRules } from '../validators/clubStaffValidators.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

/**
 * @swagger
 * /clubs:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List clubs (optionally include teams)
 */
router.get(
  '/',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.list
);
router.post('/sync', auth, authorize('ADMIN'), controller.sync);

/**
 * @swagger
 * /clubs/{id}/staff:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List staff assigned to a club
 */
router.get('/:id/staff', auth, authorize('ADMIN'), clubStaffController.list);
/**
 * @swagger
 * /clubs/{id}/staff:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Attach staff to a club
 */
router.post(
  '/:id/staff',
  auth,
  authorize('ADMIN'),
  addClubStaffRules,
  validate,
  clubStaffController.add
);
/**
 * @swagger
 * /clubs/{id}/staff/{userId}:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: Detach staff from a club
 */
router.delete(
  '/:id/staff/:userId',
  auth,
  authorize('ADMIN'),
  clubStaffController.remove
);

export default router;
