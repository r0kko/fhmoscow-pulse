import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/leaguesAccessAdminController.js';
import validate from '../middlewares/validate.js';
import {
  leaguesAccessGrantRules,
  leaguesAccessListRules,
  leaguesAccessRevokeRules,
} from '../validators/leaguesAccessValidators.js';

const router = express.Router();

router.get(
  '/meta/current',
  auth,
  authorize('ADMIN'),
  leaguesAccessListRules,
  validate,
  controller.getCurrentMeta
);
router.get(
  '/',
  auth,
  authorize('ADMIN'),
  leaguesAccessListRules,
  validate,
  controller.list
);
router.get(
  '/candidates',
  auth,
  authorize('ADMIN'),
  leaguesAccessListRules,
  validate,
  controller.listCandidates
);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  leaguesAccessGrantRules,
  validate,
  controller.grant
);
router.delete(
  '/:id',
  auth,
  authorize('ADMIN'),
  leaguesAccessRevokeRules,
  validate,
  controller.revoke
);

export default router;
