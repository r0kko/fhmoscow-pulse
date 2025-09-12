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
import accessLog from './src/middlewares/accessLog.js';
import swaggerSpec from './src/docs/swagger.js';
import { ALLOWED_ORIGINS } from './src/config/cors.js';
import { sendError } from './src/utils/api.js';
import logger from './logger.js';
import { httpMetricsMiddleware } from './src/config/metrics.js';

const app = express();
// Trust upstream proxies (DDoS/WAF/CDN + LB) to populate X-Forwarded-*
// Use a bounded number of hops to reduce spoofing risk if edge misconfigures.
const TRUST_PROXY_HOPS = parseInt(process.env.TRUST_PROXY_HOPS || '2', 10);
app.set('trust proxy', TRUST_PROXY_HOPS);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
function originAllowed(origin) {
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

const corsOptions = {
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
// Align security headers with the edge (CDN/DDoS/WAF). To avoid conflicts and
// duplicates across layers, keep most security headers at the outermost
// terminator. Here we disable Helmet sub-middleware that would duplicate
// headers often injected by CDNs (DDoS-Guard/Cloudflare) or nginx.
app.use(
  helmet({
    // Outer TLS terminator should set HSTS
    hsts: false,
    // Security policy and cross-origin headers typically enforced at edge
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    // Frame policy is also set at edge; avoid conflicts (SAMEORIGIN vs DENY)
    frameguard: false,
    // Avoid duplicate referrer policy
    referrerPolicy: false,
    // Keep X-Content-Type-Options for safer MIME sniffing
    // (duplication with edge is harmless but beneficial if edge misses it)
    noSniff: true,
    // Disable legacy IE headers and Adobe policy header (often duplicated upstream)
    ieNoOpen: false,
    permittedCrossDomainPolicies: false,
    // DNS prefetch control often set by edge
    dnsPrefetchControl: false,
    // Keep hidePoweredBy (removes X-Powered-By)
  })
);
app.use(requestId);
// Lightweight structured HTTP access logs to stdout (Loki/Promtail friendly)
app.use(accessLog());
app.use(rateLimiter);
app.use(session);
// Expose CSRF token in a cookie so the Vue client can read it
app.use(csrfMiddleware);
// Record per-request metrics (latency and totals)
app.use(httpMetricsMiddleware());
app.use(requestLogger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/', indexRouter);

// Catch unhandled routes
app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// Centralized error handler
app.use((err, req, res, _next) => {
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
});

export default app;
