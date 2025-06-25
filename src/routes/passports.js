import express from 'express';

import auth from '../middlewares/auth.js';
import passportController from '../controllers/passportController.js';
import selfController from '../controllers/passportSelfController.js';
import { createPassportRules } from '../validators/passportValidators.js';

const router = express.Router();

router.get('/me', auth, passportController.me);
router.post('/import', auth, passportController.importFromLegacy);
router.post('/', auth, createPassportRules, selfController.create);
router.put('/', auth, createPassportRules, selfController.update);
router.delete('/', auth, selfController.remove);

export default router;
