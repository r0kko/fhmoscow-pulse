import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import accessScope from '../middlewares/accessScope.js';
import controller from '../controllers/teamController.js';
import teamStaffController from '../controllers/teamStaffController.js';
import { addTeamStaffRules } from '../validators/teamStaffValidators.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

/**
 * @swagger
 * /teams:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List teams
 */
router.get(
  '/',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  controller.list
);
router.post('/sync', auth, authorize('ADMIN'), controller.sync);

/**
 * @swagger
 * /teams/{id}/staff:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List staff assigned to a team
 */
router.get(
  '/:id/staff',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  teamStaffController.listForStaff
);
/**
 * @swagger
 * /teams/{id}/staff:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Attach staff to a team
 */
router.post(
  '/:id/staff',
  auth,
  authorize('ADMIN'),
  addTeamStaffRules,
  validate,
  teamStaffController.add
);
/**
 * @swagger
 * /teams/{id}/staff/{userId}:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: Detach staff from a team
 */
router.delete(
  '/:id/staff/:userId',
  auth,
  authorize('ADMIN'),
  teamStaffController.remove
);

export default router;
