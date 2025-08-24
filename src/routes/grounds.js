import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/groundAdminController.js';
import selfController from '../controllers/groundSelfController.js';
import linkController from '../controllers/groundLinkController.js';
import groundSyncController from '../controllers/groundSyncController.js';
import accessScope from '../middlewares/accessScope.js';
import {
  groundCreateRules,
  groundUpdateRules,
} from '../validators/groundValidators.js';
import {
  addGroundClubRules,
  addGroundTeamRules,
} from '../validators/groundLinkValidators.js';

const router = express.Router();

// Staff-facing: list available grounds grouped by user's clubs
router.get(
  '/available',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  selfController.available
);

router.get('/', auth, authorize('ADMIN'), controller.list);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  groundCreateRules,
  controller.create
);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  groundUpdateRules,
  controller.update
);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

// manual external sync
router.post('/sync', auth, authorize('ADMIN'), groundSyncController.sync);

// ground links: clubs
router.get('/:id/clubs', auth, authorize('ADMIN'), linkController.listClubs);
router.post(
  '/:id/clubs',
  auth,
  authorize('ADMIN'),
  addGroundClubRules,
  linkController.addClub
);
router.delete(
  '/:id/clubs/:clubId',
  auth,
  authorize('ADMIN'),
  linkController.removeClub
);

// ground links: teams
router.get('/:id/teams', auth, authorize('ADMIN'), linkController.listTeams);
router.post(
  '/:id/teams',
  auth,
  authorize('ADMIN'),
  addGroundTeamRules,
  linkController.addTeam
);
router.delete(
  '/:id/teams/:teamId',
  auth,
  authorize('ADMIN'),
  linkController.removeTeam
);

export default router;
