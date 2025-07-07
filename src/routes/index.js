import express from 'express';

import auth from '../middlewares/auth.js';
import requireActive from '../middlewares/requireActive.js';
import csrf from '../config/csrf.js';

import authRouter from './auth.js';
import usersRouter from './users.js';
import emailRouter from './email.js';
import passportsRouter from './passports.js';
import dadataRouter from './dadata.js';
import innsRouter from './inns.js';
import snilsRouter from './snils.js';
import bankAccountsRouter from './bankAccounts.js';
import addressesRouter from './addresses.js';
import medicalCertificatesRouter from './medicalCertificates.js';
import taxationsRouter from './taxations.js';
import rolesRouter from './roles.js';
import registerRouter from './register.js';
import profileRouter from './profile.js';
import passwordResetRouter from './passwordReset.js';
import campStadiumsRouter from './campStadiums.js';
import campTrainingTypesRouter from './campTrainingTypes.js';
import campTrainingsRouter from './campTrainings.js';
import campSeasonsRouter from './campSeasons.js';
import refereeGroupsRouter from './refereeGroups.js';
import refereeGroupUsersRouter from './refereeGroupUsers.js';
import medicalCentersRouter from './medicalCenters.js';
import medicalExamsRouter from './medicalExams.js';
import trainingRolesRouter from './trainingRoles.js';
import sexesRouter from './sexes.js';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/email', emailRouter);
router.use('/passports', passportsRouter);
router.use('/dadata', dadataRouter);
router.use('/inns', innsRouter);
router.use('/snils', snilsRouter);
router.use('/addresses', addressesRouter);
router.use('/bank-accounts', bankAccountsRouter);
router.use('/medical-certificates', medicalCertificatesRouter);
router.use('/taxations', taxationsRouter);
router.use('/roles', rolesRouter);
router.use('/sexes', sexesRouter);
router.use('/training-roles', trainingRolesRouter);
router.use('/register', registerRouter);
router.use('/profile', profileRouter);
router.use('/password-reset', passwordResetRouter);
router.use('/camp-stadiums', campStadiumsRouter);
router.use('/camp-training-types', campTrainingTypesRouter);
router.use('/camp-trainings', campTrainingsRouter);
router.use('/camp-seasons', campSeasonsRouter);
router.use('/referee-groups', refereeGroupsRouter);
router.use('/referee-group-users', refereeGroupUsersRouter);
router.use('/medical-centers', medicalCentersRouter);
router.use('/medical-exams', medicalExamsRouter);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     responses:
 *       200:
 *         description: Service status
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * @swagger
 * /csrf-token:
 *   get:
 *     summary: Retrieve CSRF token
 *     responses:
 *       200:
 *         description: Token value
 */
router.get('/csrf-token', csrf, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

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
router.get('/', auth, requireActive, (req, res) => {
  const response = { user: req.user };
  res.locals.body = response;
  res.json(response);
});

export default router;
