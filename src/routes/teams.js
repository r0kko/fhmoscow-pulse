import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import accessScope from '../middlewares/accessScope.js';
import controller from '../controllers/teamController.js';
import teamStaffController from '../controllers/teamStaffController.js';
import requireSportSchoolManager from '../middlewares/requireSportSchoolManager.js';
import matchProtocolExportRateLimiter from '../middlewares/matchProtocolExportRateLimiter.js';
import { addTeamStaffRules } from '../validators/teamStaffValidators.js';
import validate from '../middlewares/validate.js';
import { teamCreateRules } from '../validators/teamValidators.js';

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
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  teamCreateRules,
  validate,
  controller.create
);
router.post('/sync', auth, authorize('ADMIN'), controller.sync);

router.post(
  '/:id/participation-summary/export.xlsx',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.exportParticipationSummary
);

router.post(
  '/:id/participation-summary/export-signed.pdf',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.exportParticipationSummarySignedPdf
);

router.get(
  '/:id/participation-summary/ias-events',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.participationSummaryIasEvents
);

router.post(
  '/:id/participation-summary/signed-documents',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.createParticipationSummarySignedDocument
);

router.post(
  '/:id/participation-summary/protocols/export-jobs',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  matchProtocolExportRateLimiter,
  controller.createProtocolExportJob
);

router.get(
  '/:id/participation-summary/protocols/export-jobs/:jobId/download.zip',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.downloadProtocolExport
);

router.get(
  '/:id/participation-summary/protocols/export-jobs/:jobId',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.protocolExportJob
);

router.get(
  '/:id/participation-summary',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.participationSummary
);

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
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  requireSportSchoolManager({ teamParam: 'id', clubParam: null }),
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
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  requireSportSchoolManager({ teamParam: 'id', clubParam: null }),
  teamStaffController.remove
);

export default router;
