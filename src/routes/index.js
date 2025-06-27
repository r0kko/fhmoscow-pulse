import express from 'express';

import auth from '../middlewares/auth.js';

import authRouter from './auth.js';
import usersRouter from './users.js';
import emailRouter from './email.js';
import passportsRouter from './passports.js';
import dadataRouter from './dadata.js';
import innsRouter from './inns.js';
import snilsRouter from './snils.js';
import bankAccountsRouter from './bankAccounts.js';
import taxationsRouter from './taxations.js';
import registerRouter from './register.js';
import profileRouter from './profile.js';
import documentsRouter from './documents.js';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/email', emailRouter);
router.use('/passports', passportsRouter);
router.use('/dadata', dadataRouter);
router.use('/inns', innsRouter);
router.use('/snils', snilsRouter);
router.use('/bank-accounts', bankAccountsRouter);
router.use('/taxations', taxationsRouter);
router.use('/documents', documentsRouter);
router.use('/register', registerRouter);
router.use('/profile', profileRouter);

/**
 * @swagger
 * /:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get current user information
 *     responses:
 *       200:
 *         description: Returns authenticated user info
 */
router.get('/', auth, (req, res) => {
  const response = { user: req.user };
  res.locals.body = response;
  res.json(response);
});

export default router;
