import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/tournamentAdminController.js';
import accountingController from '../controllers/refereeAccountingController.js';
import validate from '../middlewares/validate.js';
import {
  tournamentCreateRules,
  tournamentUpdateRules,
  stageCreateRules,
  groupCreateRules,
  groupUpdateRules,
  tournamentTeamCreateRules,
  tournamentMatchCreateRules,
  tournamentMatchUpdateRules,
  groupRefereesUpdateRules,
} from '../validators/tournamentAdminValidators.js';
import {
  tariffListRules,
  paymentsDashboardRules,
  tariffCreateRules,
  tariffUpdateRules,
  accrualGenerateRules,
  accrualListRules,
  accrualIdRules,
} from '../validators/refereeAccountingValidators.js';

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
router.get(
  '/settings-options',
  auth,
  authorize('ADMIN'),
  controller.listSettingsOptions
);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  tournamentCreateRules,
  validate,
  controller.createTournament
);
router.patch(
  '/:id',
  auth,
  authorize('ADMIN'),
  tournamentUpdateRules,
  validate,
  controller.updateTournament
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
router.get(
  '/referee-roles',
  auth,
  authorize('ADMIN'),
  controller.listRefereeRoles
);
router.get(
  '/groups/referees',
  auth,
  authorize('ADMIN'),
  controller.listGroupReferees
);
router.put(
  '/groups/:id/referees',
  auth,
  authorize('ADMIN'),
  groupRefereesUpdateRules,
  validate,
  controller.updateGroupReferees
);
router.get(
  '/:tournamentId/referee-payments/dashboard',
  auth,
  authorize('ADMINISTRATOR'),
  paymentsDashboardRules,
  validate,
  accountingController.getTournamentPaymentsDashboard
);
router.get(
  '/:tournamentId/referee-tariffs',
  auth,
  authorize('ADMINISTRATOR'),
  tariffListRules,
  validate,
  accountingController.listTournamentTariffs
);
router.post(
  '/:tournamentId/referee-tariffs',
  auth,
  authorize('ADMINISTRATOR'),
  tariffCreateRules,
  validate,
  accountingController.createTournamentTariff
);
router.patch(
  '/:tournamentId/referee-tariffs/:id',
  auth,
  authorize('ADMINISTRATOR'),
  tariffUpdateRules,
  validate,
  accountingController.updateTournamentTariff
);
router.post(
  '/:tournamentId/referee-tariffs/:id/file',
  auth,
  authorize('ADMINISTRATOR'),
  accountingController.fileTournamentTariff
);
router.post(
  '/:tournamentId/referee-tariffs/:id/retire',
  auth,
  authorize('ADMINISTRATOR'),
  accountingController.retireTournamentTariff
);
router.post(
  '/:tournamentId/referee-tariffs/:id/activate',
  auth,
  authorize('ADMINISTRATOR'),
  accountingController.activateTournamentTariff
);
router.post(
  '/:tournamentId/referee-accruals/generate',
  auth,
  authorize('ADMINISTRATOR'),
  accrualGenerateRules,
  validate,
  accountingController.generateTournamentAccruals
);
router.get(
  '/:tournamentId/referee-accruals',
  auth,
  authorize('ADMINISTRATOR'),
  accrualListRules,
  validate,
  accountingController.listTournamentAccruals
);
router.get(
  '/:tournamentId/referee-accruals/:id',
  auth,
  authorize('ADMINISTRATOR'),
  accrualIdRules,
  validate,
  accountingController.getTournamentAccrualDocument
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
router.post(
  '/teams',
  auth,
  authorize('ADMIN'),
  tournamentTeamCreateRules,
  validate,
  controller.createTournamentTeam
);
router.get(
  '/matches',
  auth,
  authorize('ADMIN'),
  controller.listTournamentMatches
);
router.post(
  '/matches',
  auth,
  authorize('ADMIN'),
  tournamentMatchCreateRules,
  validate,
  controller.createTournamentMatch
);
router.patch(
  '/matches/:id',
  auth,
  authorize('ADMIN'),
  tournamentMatchUpdateRules,
  validate,
  controller.updateTournamentMatch
);
router.delete(
  '/matches/:id',
  auth,
  authorize('ADMIN'),
  controller.deleteTournamentMatch
);
router.get('/:id', auth, authorize('ADMIN'), controller.getTournament);

export default router;
