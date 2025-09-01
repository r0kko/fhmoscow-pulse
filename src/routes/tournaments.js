import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/tournamentAdminController.js';

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

/**
 * @swagger
 * /tournaments/stages:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List stages (across tournaments)
 */
router.get('/stages', auth, authorize('ADMIN'), controller.listStages);

/**
 * @swagger
 * /tournaments/groups:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List tournament groups
 */
router.get('/groups', auth, authorize('ADMIN'), controller.listGroups);

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
