import express from 'express';

import controller from '../controllers/registrationController.js';
import {
  startRegistrationRules,
  finishRegistrationRules,
} from '../validators/registrationValidators.js';
import registrationRateLimiter from '../middlewares/registrationRateLimiter.js';

const router = express.Router();

router.post(
  '/start',
  registrationRateLimiter,
  startRegistrationRules,
  controller.start
);
router.post(
  '/finish',
  registrationRateLimiter,
  finishRegistrationRules,
  controller.finish
);

export default router;
