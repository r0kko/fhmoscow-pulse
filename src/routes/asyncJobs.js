import express from 'express';

import controller from '../controllers/asyncJobController.js';
import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import validate from '../middlewares/validate.js';
import { uuidParam } from '../validators/paramsValidators.js';

const router = express.Router();

router.get(
  '/:jobId',
  auth,
  authorize('ADMINISTRATOR'),
  ...uuidParam('jobId'),
  validate,
  controller.getJob
);
router.get(
  '/:jobId/items',
  auth,
  authorize('ADMINISTRATOR'),
  ...uuidParam('jobId'),
  validate,
  controller.listItems
);
router.post(
  '/:jobId/retry-failed',
  auth,
  authorize('ADMINISTRATOR'),
  ...uuidParam('jobId'),
  validate,
  controller.retryFailed
);
router.post(
  '/:jobId/cancel',
  auth,
  authorize('ADMINISTRATOR'),
  ...uuidParam('jobId'),
  validate,
  controller.cancel
);

export default router;
