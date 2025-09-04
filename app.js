import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import helmet from 'helmet';

import csrfMiddleware from './src/middlewares/csrf.js';
import session from './src/config/session.js';
import indexRouter from './src/routes/index.js';
import requestLogger from './src/middlewares/requestLogger.js';
import requestId from './src/middlewares/requestId.js';
import rateLimiter from './src/middlewares/rateLimiter.js';
import swaggerSpec from './src/docs/swagger.js';
import { ALLOWED_ORIGINS } from './src/config/cors.js';
import { sendError } from './src/utils/api.js';
import logger from './logger.js';

const app = express();
app.set('trust proxy', 2);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(requestId);
app.use(rateLimiter);
app.use(session);
// Expose CSRF token in a cookie so the Vue client can read it
app.use(csrfMiddleware);
app.use(requestLogger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/', indexRouter);

// Catch unhandled routes
app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// Centralized error handler
app.use((err, req, res, _next) => {
  const status = err?.status || 500;
  if (status >= 500) {
    logger.error(
      'Unhandled server error [%s]: %s',
      req.id || '-',
      err.stack || err
    );
  } else {
    const code = err?.code || err?.message || 'error';
    logger.warn('Request failed [%s]: %s (%s)', req.id || '-', code, status);
  }
  sendError(res, err, 500);
});

export default app;
