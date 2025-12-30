import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/tournamentAdminController.js';
import validate from '../middlewares/validate.js';
import {
  tournamentCreateRules,
  stageCreateRules,
  groupCreateRules,
  groupUpdateRules,
} from '../validators/tournamentAdminValidators.js';

const router = express.Router();

/**
 * @swagger
 * /tournaments:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List tournaments with optional aggregates
 */
router.get('/', auth, authorize('ADMIN'), controller.listTournaments);
router.get('/types', auth, authorize('ADMIN'), controller.listTypes);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  tournamentCreateRules,
  validate,
  controller.createTournament
);

/**
 * @swagger
 * /tournaments/stages:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List stages (across tournaments)
 */
router.get('/stages', auth, authorize('ADMIN'), controller.listStages);
router.post(
  '/stages',
  auth,
  authorize('ADMIN'),
  stageCreateRules,
  validate,
  controller.createStage
);

/**
 * @swagger
 * /tournaments/groups:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List tournament groups
 */
router.get('/groups', auth, authorize('ADMIN'), controller.listGroups);
router.post(
  '/groups',
  auth,
  authorize('ADMIN'),
  groupCreateRules,
  validate,
  controller.createGroup
);
router.patch(
  '/groups/:id',
  auth,
  authorize('ADMIN'),
  groupUpdateRules,
  validate,
  controller.updateGroup
);

/**
 * @swagger
 * /tournaments/teams:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List tournament teams assignments
 */
router.get('/teams', auth, authorize('ADMIN'), controller.listTournamentTeams);

export default router;
