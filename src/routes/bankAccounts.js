import express from 'express';

import auth from '../middlewares/auth.js';
import bankAccountController from '../controllers/bankAccountController.js';
import selfController from '../controllers/bankAccountSelfController.js';
import { bankAccountRules } from '../validators/bankAccountValidators.js';

const router = express.Router();

router.get('/me', auth, bankAccountController.me);
router.post('/', auth, bankAccountRules, selfController.create);
router.delete('/', auth, selfController.remove);

export default router;
