import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import csrfMiddleware from './src/middlewares/csrf.js';
import session from './src/config/session.js';
import indexRouter from './src/routes/index.js';
import requestLogger from './src/middlewares/requestLogger.js';
import requestId from './src/middlewares/requestId.js';
import rateLimiter from './src/middlewares/rateLimiter.js';
import accessLog from './src/middlewares/accessLog.js';
import { ALLOWED_ORIGINS } from './src/config/cors.js';
import { sendError } from './src/utils/api.js';
import logger from './logger.js';
import {
  httpMetricsMiddleware,
  startBusinessMetricsCollector,
} from './src/config/metrics.js';
import swaggerSpec from './src/docs/swagger.js';
import apiDocsGuard from './src/middlewares/apiDocsGuard.js';
import {
  helmetMiddleware,
  contentSecurityPolicyMiddleware,
  swaggerContentSecurityPolicyMiddleware,
} from './src/config/helmetConfig.js';

const app = express();
// Trust upstream proxies (DDoS/WAF/CDN + LB) to populate X-Forwarded-*
// Use a bounded number of hops to reduce spoofing risk if edge misconfigures.
const TRUST_PROXY_HOPS = parseInt(process.env.TRUST_PROXY_HOPS || '2', 10);
app.set('trust proxy', TRUST_PROXY_HOPS);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
export function originAllowed(origin) {
  try {
    if (!origin) return true; // same-origin/non-browser
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin))
      return true;
    const url = new URL(origin);
    const host = url.hostname;
    const cookieDomain = process.env.COOKIE_DOMAIN || '';
    if (
      cookieDomain &&
      (host === cookieDomain || host.endsWith(`.${cookieDomain}`))
    )
      return true;
    const base = process.env.BASE_URL ? new URL(process.env.BASE_URL) : null;
    if (base && base.origin === origin) return true;
  } catch (_) {
    /* noop */
  }
  return false;
}

export const corsOptions = {
  origin(origin, callback) {
    if (originAllowed(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-XSRF-TOKEN',
    'X-Request-Id',
  ],
  credentials: true,
  exposedHeaders: ['X-Request-Id'],
  optionsSuccessStatus: 204,
  preflightContinue: false,
};

// Fast CORS preflight path and runtime origin verification
app.use(cors(corsOptions));
// Express 5 uses path-to-regexp@^6 which is stricter about patterns like '*'.
// Use a RegExp to match any path for CORS preflight to avoid parsing errors.
app.options(/.*/, cors(corsOptions));
// Harden HTTP security headers while allowing controlled overrides via env.
app.use(helmetMiddleware);
if (contentSecurityPolicyMiddleware) {
  app.use(contentSecurityPolicyMiddleware);
}
app.use(requestId);
// Lightweight structured HTTP access logs to stdout (Loki/Promtail friendly)
app.use(accessLog());
app.use(rateLimiter);
app.use(session);
// Expose CSRF token in a cookie so the Vue client can read it
app.use(csrfMiddleware);
// Record per-request metrics (latency and totals)
app.use(httpMetricsMiddleware());
if (process.env.NODE_ENV !== 'test') {
  startBusinessMetricsCollector().catch((err) => {
    logger.warn(
      'Business metrics collector failed to start: %s',
      err?.message || err
    );
  });
}
app.use(requestLogger);

const swaggerMiddlewares = [apiDocsGuard, swaggerUi.serve, swaggerUi.setup(swaggerSpec)];
if (swaggerContentSecurityPolicyMiddleware) {
  swaggerMiddlewares.unshift(swaggerContentSecurityPolicyMiddleware);
}
app.use('/api-docs', ...swaggerMiddlewares);

app.use('/', indexRouter);

// Catch unhandled routes
app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// Centralized error handler
export function errorHandler(err, req, res, _next) {
  // Normalize common, expected errors for consistent API responses
  let normalized = err;
  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('csrf token mismatch') || msg.includes('ebadcsrftoken')) {
    normalized = { status: 403, code: 'EBADCSRFTOKEN' };
  }

  const status = normalized?.status || 500;
  if (status >= 500) {
    logger.error(
      'Unhandled server error [%s]: %s',
      req.id || '-',
      err.stack || err
    );
  } else {
    const code = normalized?.code || normalized?.message || 'error';
    logger.warn('Request failed [%s]: %s (%s)', req.id || '-', code, status);
  }
  // Respect normalized status; fall back to 400 for non-specified errors
  sendError(res, normalized);
}

app.use(errorHandler);

export default app;
