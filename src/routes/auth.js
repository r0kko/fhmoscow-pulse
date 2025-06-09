import express from 'express';

import authController from '../controllers/authController.js';
import auth from '../middlewares/auth.js';
import {loginRules, refreshRules} from '../validators/authValidators.js';

const router = express.Router();

/* --------------------------------------------------------------------------
 * POST /auth/login
 * Body: { email, password }
 * -------------------------------------------------------------------------*/
router.post('/login', loginRules, authController.login);
/* --------------------------------------------------------------------------
 * POST /auth/logout
 * Requires valid access token
 * -------------------------------------------------------------------------*/
router.post('/logout', auth, authController.logout);

/* --------------------------------------------------------------------------
 * GET /auth/me
 * Returns current user info
 * -------------------------------------------------------------------------*/
router.get('/me', auth, authController.me);

/* --------------------------------------------------------------------------
 * POST /auth/refresh
 * Body: { refresh_token }
 * Returns new access & refresh tokens
 * -------------------------------------------------------------------------*/
router.post('/refresh', refreshRules, authController.refresh);

export default router;
