import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller, { get as getMatch } from '../controllers/matchController.js';
import agreementController, {
  availableGrounds as availableAgreementGrounds,
  opponentContacts as agreementOpponentContacts,
} from '../controllers/matchAgreementController.js';
import validate from '../middlewares/validate.js';
import { createAgreementRules } from '../validators/matchAgreementValidators.js';

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

export default router;
