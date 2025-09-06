import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller, { get as getMatch } from '../controllers/matchController.js';
import adminController, {
  setSchedule as setAdminSchedule,
} from '../controllers/matchAdminController.js';
import { adminSetScheduleRules } from '../validators/matchAdminValidators.js';
import validate from '../middlewares/validate.js';
import agreementController, {
  availableGrounds as availableAgreementGrounds,
  opponentContacts as agreementOpponentContacts,
} from '../controllers/matchAgreementController.js';
import { rescheduleRules } from '../validators/matchRescheduleValidators.js';
import rescheduleController from '../controllers/matchRescheduleController.js';
import { createAgreementRules } from '../validators/matchAgreementValidators.js';
import lineupController from '../controllers/matchLineupController.js';
import { setLineupRules } from '../validators/matchLineupValidators.js';
import lineupExportController from '../controllers/matchLineupExportController.js';
import matchStaffController from '../controllers/matchStaffController.js';
import { setMatchStaffRules } from '../validators/matchStaffValidators.js';
import broadcastController from '../controllers/broadcastController.js';

const router = express.Router();

router.get(
  '/upcoming',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  controller.listUpcoming
);

router.get(
  '/past',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  controller.listPast
);

router.get('/:id', auth, authorize('ADMIN', 'SPORT_SCHOOL_STAFF'), getMatch);

// Agreements
router.get(
  '/:id/agreements',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  agreementController.list
);

// Lineups
router.get(
  '/:id/lineups',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  lineupController.list
);
router.post(
  '/:id/lineups',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  setLineupRules,
  validate,
  lineupController.set
);

// Lineups export (PDF)
router.get(
  '/:id/lineups/export.pdf',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  lineupExportController.exportPlayers
);
router.get(
  '/:id/representatives/export.pdf',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  lineupExportController.exportRepresentatives
);

// Staff selection
router.get(
  '/:id/staff',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  matchStaffController.list
);
router.post(
  '/:id/staff',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  setMatchStaffRules,
  validate,
  matchStaffController.set
);

router.post(
  '/:id/agreements',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  createAgreementRules,
  validate,
  agreementController.create
);

router.post(
  '/:id/agreements/:agreementId/approve',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  agreementController.approve
);

router.post(
  '/:id/agreements/:agreementId/decline',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  agreementController.decline
);

// Available grounds for agreements (side-aware)
router.get(
  '/:id/available-grounds',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  availableAgreementGrounds
);

router.post(
  '/:id/agreements/:agreementId/withdraw',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  agreementController.withdraw
);

// Opponent contacts for participants
router.get(
  '/:id/opponent-contacts',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  agreementOpponentContacts
);

// Reschedule postponed match: set new date (MSK 00:00), clear external cancel_status
router.post(
  '/:id/reschedule',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  rescheduleRules,
  validate,
  rescheduleController.reschedule
);

// Admin: reconcile broadcast links for a match from external DB
router.post(
  '/:id/sync-broadcasts',
  auth,
  authorize('ADMIN'),
  broadcastController.reconcile
);

// Admin: calendar for the next N days (default 10), global scope
router.get(
  '/admin/calendar',
  auth,
  authorize('ADMIN'),
  adminController.calendar
);

// Admin: set schedule (kickoff + ground) and lock further changes by clubs
router.post(
  '/admin/:id/schedule',
  auth,
  authorize('ADMIN'),
  adminSetScheduleRules,
  validate,
  setAdminSchedule
);

export default router;
