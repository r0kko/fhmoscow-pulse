import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import validate from '../middlewares/validate.js';
import controller from '../controllers/refereeAssignmentAdminController.js';
import selfController from '../controllers/refereeAssignmentSelfController.js';
import {
  refereeAssignmentsListRules,
  refereeAssignmentsListRefereesRules,
  refereeAssignmentsUpdateRules,
  refereeAssignmentsPublishMatchRules,
  refereeAssignmentsPublishDayRules,
  refereeAssignmentsCreateSheetRules,
  refereeAssignmentsSheetStatusRules,
  refereeAssignmentsSelfListRules,
  refereeAssignmentsSelfConfirmRules,
  refereeAssignmentsSelfMatchRules,
} from '../validators/refereeAssignmentValidators.js';

const router = express.Router();

router.get('/role-groups', auth, authorize('ADMIN'), controller.listRoleGroups);
router.get(
  '/matches',
  auth,
  authorize('ADMIN'),
  refereeAssignmentsListRules,
  validate,
  controller.listMatches
);
router.get(
  '/referees',
  auth,
  authorize('ADMIN'),
  refereeAssignmentsListRefereesRules,
  validate,
  controller.listReferees
);
router.put(
  '/matches/:id/referees',
  auth,
  authorize('ADMIN'),
  refereeAssignmentsUpdateRules,
  validate,
  controller.updateMatchReferees
);
router.post(
  '/matches/:id/publish',
  auth,
  authorize('ADMIN'),
  refereeAssignmentsPublishMatchRules,
  validate,
  controller.publishMatchReferees
);
router.get(
  '/matches/:id/assignment-sheet',
  auth,
  authorize('ADMIN'),
  refereeAssignmentsSheetStatusRules,
  validate,
  controller.getMatchAssignmentsSheet
);
router.post(
  '/matches/:id/assignment-sheet',
  auth,
  authorize('ADMIN'),
  refereeAssignmentsCreateSheetRules,
  validate,
  controller.createMatchAssignmentsSheet
);
router.post(
  '/publish',
  auth,
  authorize('ADMIN'),
  refereeAssignmentsPublishDayRules,
  validate,
  controller.publishDay
);
router.get(
  '/my',
  auth,
  authorize('REFEREE'),
  refereeAssignmentsSelfListRules,
  validate,
  selfController.listMyAssignments
);
router.get(
  '/my/matches/:id',
  auth,
  authorize('REFEREE'),
  refereeAssignmentsSelfMatchRules,
  validate,
  selfController.getMyMatchDetails
);
router.get('/my/dates', auth, authorize('REFEREE'), selfController.listMyDates);
router.post(
  '/my/confirm',
  auth,
  authorize('REFEREE'),
  refereeAssignmentsSelfConfirmRules,
  validate,
  selfController.confirmDayAssignments
);

export default router;
