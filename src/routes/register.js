import express from 'express';

import controller from '../controllers/registrationController.js';
import { startRegistrationRules, finishRegistrationRules } from '../validators/registrationValidators.js';

const router = express.Router();

router.post('/start', startRegistrationRules, controller.start);
router.post('/finish', finishRegistrationRules, controller.finish);

export default router;
