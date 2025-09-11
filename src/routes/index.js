import express from 'express';

import { isReady, isSyncing } from '../config/readiness.js';
import auth from '../middlewares/auth.js';
import requireActive from '../middlewares/requireActive.js';
import csrf from '../config/csrf.js';
import { issueCsrfHmac } from '../utils/csrfHmac.js';
import { getRuntimeStates } from '../config/metrics.js';

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
import groundsRouter from './grounds.js';
import campTrainingTypesRouter from './campTrainingTypes.js';
import campTrainingsRouter from './campTrainings.js';
import campSeasonsRouter from './campSeasons.js';
import refereeGroupsRouter from './refereeGroups.js';
import refereeGroupUsersRouter from './refereeGroupUsers.js';
import medicalCentersRouter from './medicalCenters.js';
import medicalExamsRouter from './medicalExams.js';
import trainingRolesRouter from './trainingRoles.js';
import sexesRouter from './sexes.js';
import documentsRouter from './documents.js';
import ticketsRouter from './tickets.js';
import tasksRouter from './tasks.js';
import availabilitiesRouter from './availabilities.js';
import signTypesRouter from './signTypes.js';
import normativeTypesRouter from './normativeTypes.js';
import normativeGroupsRouter from './normativeGroups.js';
import normativeResultsRouter from './normativeResults.js';
import normativeLedgerRouter from './normativeLedger.js';
import measurementUnitsRouter from './measurementUnits.js';
import normativeValueTypesRouter from './normativeValueTypes.js';
import normativeZonesRouter from './normativeZones.js';
import normativesRouter from './normatives.js';
import normativeTicketsRouter from './normativeTickets.js';
import seasonsRouter from './seasons.js';
import coursesRouter from './courses.js';
import courseUsersRouter from './courseUsers.js';
import courseTrainingTypesRouter from './courseTrainingTypes.js';
import courseTrainingsRouter from './courseTrainings.js';
import vehiclesRouter from './vehicles.js';
import teamsRouter from './teams.js';
import clubsRouter from './clubs.js';
import matchesRouter from './matches.js';
import tournamentsRouter from './tournaments.js';
import playersRouter from './players.js';
import staffRouter from './staff.js';
import sportSchoolsRouter from './sportSchools.js';
import metricsRouter from './metrics.js';
import adminOpsRouter from './adminOps.js';
import reportsRouter from './reports.js';
import verifyRouter from './verify.js';
import shortLinksRouter from './shortLinks.js';

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
router.use('/grounds', groundsRouter);
router.use('/camp-training-types', campTrainingTypesRouter);
router.use('/course-training-types', courseTrainingTypesRouter);
router.use('/camp-trainings', campTrainingsRouter);
router.use('/course-trainings', courseTrainingsRouter);
router.use('/seasons', seasonsRouter);
router.use('/camp-seasons', campSeasonsRouter);
router.use('/referee-groups', refereeGroupsRouter);
router.use('/referee-group-users', refereeGroupUsersRouter);
router.use('/medical-centers', medicalCentersRouter);
router.use('/medical-exams', medicalExamsRouter);
router.use('/documents', documentsRouter);
router.use('/sign-types', signTypesRouter);
router.use('/normative-types', normativeTypesRouter);
router.use('/normative-groups', normativeGroupsRouter);
router.use('/normative-results', normativeResultsRouter);
router.use('/normative-ledger', normativeLedgerRouter);
router.use('/measurement-units', measurementUnitsRouter);
router.use('/normative-value-types', normativeValueTypesRouter);
router.use('/normative-zones', normativeZonesRouter);
router.use('/normatives', normativesRouter);
router.use('/normative-tickets', normativeTicketsRouter);
router.use('/courses', coursesRouter);
router.use('/course-users', courseUsersRouter);
router.use('/tasks', tasksRouter);
router.use('/availabilities', availabilitiesRouter);
router.use('/tickets', ticketsRouter);
router.use('/vehicles', vehiclesRouter);
router.use('/teams', teamsRouter);
router.use('/clubs', clubsRouter);
router.use('/matches', matchesRouter);
router.use('/tournaments', tournamentsRouter);
router.use('/players', playersRouter);
router.use('/staff', staffRouter);
router.use('/sport-schools', sportSchoolsRouter);
router.use('/metrics', metricsRouter);
router.use('/admin-ops', adminOpsRouter);
router.use('/reports', reportsRouter);
router.use('/v', shortLinksRouter);
router.use('/verify', verifyRouter);

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
  const runtime = getRuntimeStates();
  res.json({
    status: 'ok',
    ready: isReady(),
    syncing: isSyncing(),
    db_up: runtime.dbUp,
    cache_up: runtime.cacheUp,
  });
});

// Liveness and readiness probes
router.get('/live', (_req, res) => {
  res.status(200).json({ status: 'live' });
});
router.get('/ready', (_req, res) => {
  res.status(isReady() ? 200 : 503).json({ ready: isReady() });
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
  // Avoid any caching of CSRF token responses at client/CDN proxies
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  if (typeof res?.vary === 'function') {
    res.vary('Cookie');
    res.vary('Origin');
  }
  const json = { csrfToken: req.csrfToken() };
  try {
    json.csrfHmac = issueCsrfHmac(req);
  } catch (_e) {
    /* if misconfigured, still return cookie-based token */
  }
  res.json(json);
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
