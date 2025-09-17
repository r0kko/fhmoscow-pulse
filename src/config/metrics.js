// Lightweight integration with Prometheus via prom-client (optional).
// Falls back to no-op if prom-client is not available at runtime.

let client = null;
let register = null;
let metricsAvailable = false;
let jobRuns = null;
let jobDuration = null;
let jobLastRun = null;
let jobLastSuccess = null;
let jobInProgress = null;
let httpRequestDuration = null;
let httpRequestsTotal = null;
let httpRequestsInflight = null;
let httpRequestSize = null;
let httpResponseSize = null;
let httpRequests5xx = null;
let appBuildInfo = null;
let appReadyGauge = null;
let appSyncingGauge = null;
let dbUpGauge = null;
let cacheUpGauge = null;
let _appReadyState = false;
let _appSyncingState = false;
let _dbUpState = false;
let _cacheUpState = false;
let dbQueryDuration = null;
let dbPoolSize = null;
let dbPoolFree = null;
let dbPoolPending = null;
let authLoginAttempts = null;
let authRefreshTotal = null;
let tokensIssued = null;
let emailSentTotal = null;
let rateLimitedTotal = null;
let csrfAcceptedTotal = null;
let csrfRejectedTotal = null;
let httpErrorCodeTotal = null;
let refreshReuseDetected = null;
let securityEvents = null;

async function ensureInit() {
  if (metricsAvailable || register !== null) return;
  try {
    client = await import('prom-client');
    register = new client.Registry();
    // Default metrics
    client.collectDefaultMetrics({
      register,
      eventLoopMonitoringPrecision: 10,
    });

    jobRuns = new client.Counter({
      name: 'job_runs_total',
      help: 'Total job runs grouped by status',
      labelNames: ['job', 'status'],
      registers: [register],
    });
    jobDuration = new client.Histogram({
      name: 'job_duration_seconds',
      help: 'Job duration in seconds',
      labelNames: ['job'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1800, 3600],
      registers: [register],
    });
    jobLastRun = new client.Gauge({
      name: 'job_last_run_timestamp_seconds',
      help: 'Unix time of last job run (start time)',
      labelNames: ['job'],
      registers: [register],
    });
    jobLastSuccess = new client.Gauge({
      name: 'job_last_success_timestamp_seconds',
      help: 'Unix time of last successful job completion',
      labelNames: ['job'],
      registers: [register],
    });
    jobInProgress = new client.Gauge({
      name: 'job_in_progress',
      help: 'Whether a job is currently running (0/1)',
      labelNames: ['job'],
      registers: [register],
    });
    // HTTP request metrics (labels kept small for cardinality)
    httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [register],
    });
    httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [register],
    });

    httpRequestsInflight = new client.Gauge({
      name: 'http_server_in_flight_requests',
      help: 'Current number of in-flight HTTP requests',
      labelNames: ['method', 'route'],
      registers: [register],
    });
    httpRequestSize = new client.Histogram({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      buckets: [
        128, 512, 1024, 2048, 4096, 8192, 16384, 65536, 262144, 1048576,
        4194304,
      ],
      registers: [register],
    });
    httpResponseSize = new client.Histogram({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP responses in bytes (Content-Length)',
      labelNames: ['method', 'route', 'status'],
      buckets: [
        128, 512, 1024, 2048, 4096, 8192, 16384, 65536, 262144, 1048576,
        4194304,
      ],
      registers: [register],
    });
    httpRequests5xx = new client.Counter({
      name: 'http_requests_5xx_total',
      help: 'HTTP 5xx responses total',
      labelNames: ['route'],
      registers: [register],
    });

    // App build info and liveness state
    appBuildInfo = new client.Gauge({
      name: 'app_build_info',
      help: 'Application build information',
      labelNames: ['service', 'version', 'env', 'commit'],
      registers: [register],
    });
    appReadyGauge = new client.Gauge({
      name: 'app_ready',
      help: 'Whether app is ready (0/1)',
      registers: [register],
    });
    appSyncingGauge = new client.Gauge({
      name: 'app_syncing',
      help: 'Whether app is currently syncing (0/1)',
      registers: [register],
    });
    dbUpGauge = new client.Gauge({
      name: 'db_up',
      help: 'Database connectivity status (0/1)',
      registers: [register],
    });
    cacheUpGauge = new client.Gauge({
      name: 'cache_up',
      help: 'Cache (Redis) connectivity status (0/1)',
      registers: [register],
    });

    // Auth and mail metrics (corporate visibility)
    authLoginAttempts = new client.Counter({
      name: 'auth_login_attempts_total',
      help: 'Login attempts grouped by result',
      labelNames: ['result'], // success|invalid
      registers: [register],
    });
    authRefreshTotal = new client.Counter({
      name: 'auth_refresh_total',
      help: 'Refresh token operations grouped by result',
      labelNames: ['result'], // success|invalid
      registers: [register],
    });
    tokensIssued = new client.Counter({
      name: 'jwt_tokens_issued_total',
      help: 'JWT tokens issued grouped by type',
      labelNames: ['type'], // access|refresh
      registers: [register],
    });
    emailSentTotal = new client.Counter({
      name: 'email_sent_total',
      help: 'Emails sent grouped by status and purpose',
      labelNames: ['status', 'purpose'], // ok|error, e.g., verification, password_reset
      registers: [register],
    });
    rateLimitedTotal = new client.Counter({
      name: 'rate_limited_total',
      help: 'Requests blocked by rate limiter grouped by limiter name',
      labelNames: ['name'], // global|login|registration|password_reset|custom
      registers: [register],
    });
    csrfAcceptedTotal = new client.Counter({
      name: 'csrf_accepted_total',
      help: 'CSRF checks accepted grouped by mode',
      labelNames: ['mode'], // cookie|hmac|skipped_safe|skipped_bearer
      registers: [register],
    });
    csrfRejectedTotal = new client.Counter({
      name: 'csrf_rejected_total',
      help: 'CSRF checks rejected grouped by reason',
      labelNames: ['reason'], // cookie_missing_or_mismatch|hmac_error|other
      registers: [register],
    });
    refreshReuseDetected = new client.Counter({
      name: 'refresh_reuse_detected_total',
      help: 'Detected refresh token reuse attempts',
      labelNames: ['result'], // detected|error
      registers: [register],
    });
    securityEvents = new client.Counter({
      name: 'security_events_total',
      help: 'Security events grouped by type',
      labelNames: ['type'], // reuse|lockout|ip_mismatch|state_loss
      registers: [register],
    });
    httpErrorCodeTotal = new client.Counter({
      name: 'http_error_code_total',
      help: 'Application error responses grouped by code and status class',
      labelNames: ['code', 'status'], // e.g., EBADCSRFTOKEN, unauthorized, 403, 401
      registers: [register],
    });

    // DB metrics (application-level)
    dbQueryDuration = new client.Histogram({
      name: 'db_query_duration_seconds',
      help: 'Database query duration seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [register],
    });
    dbPoolSize = new client.Gauge({
      name: 'db_pool_size',
      help: 'Sequelize pool total size',
      registers: [register],
    });
    dbPoolFree = new client.Gauge({
      name: 'db_pool_free',
      help: 'Sequelize pool free (available) resources',
      registers: [register],
    });
    dbPoolPending = new client.Gauge({
      name: 'db_pool_pending',
      help: 'Sequelize pool pending (waiting) requests',
      registers: [register],
    });

    metricsAvailable = true;
  } catch {
    // prom-client not available; metrics disabled
    client = null;
    register = null;
    metricsAvailable = false;
  }
}

function normalizeRouteLabel(label) {
  if (!label) return '/';
  if (Array.isArray(label)) {
    const first = label.find((entry) => typeof entry === 'string' && entry);
    label = first || label[0] || '';
  }
  const raw = String(label || '');
  if (!raw) return '/';
  let cleaned = raw.replace(/\/{2,}/g, '/');
  if (!cleaned.startsWith('/')) cleaned = `/${cleaned}`;
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.replace(/\/+$/, '');
    if (cleaned === '') cleaned = '/';
  }
  return cleaned || '/';
}

function resolveRouteLabel(req) {
  const base =
    typeof req.baseUrl === 'string' && req.baseUrl !== '/'
      ? req.baseUrl
      : req.baseUrl === '/'
        ? '/'
        : '';
  let path = req.route?.path;
  if (Array.isArray(path)) {
    path =
      path.find((entry) => typeof entry === 'string' && entry.length > 0) ||
      path[0];
  }
  if (typeof path === 'string') {
    if (path === '/' || path === '') {
      return base || '/';
    }
    const prefix = base && base !== '/' ? base : base === '/' ? '' : '';
    const needsSlash = prefix && !path.startsWith('/');
    const combined = `${prefix}${needsSlash ? '/' : ''}${path}`;
    return normalizeRouteLabel(combined);
  }
  if (base) return normalizeRouteLabel(base);
  return 'unmatched';
}

// Express middleware to record per-request metrics
export function httpMetricsMiddleware() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    const method = (req.method || 'GET').toUpperCase();
    const route = resolveRouteLabel(req);
    let inflightTracked = false;

    try {
      if (metricsAvailable) {
        httpRequestsInflight.inc({ method, route });
        inflightTracked = true;
      }
    } catch {
      /* ignore metric errors */
    }

    let completed = false;
    const finalize = (aborted = false) => {
      if (completed) return;
      completed = true;

      if (inflightTracked) {
        try {
          httpRequestsInflight.dec({ method, route });
        } catch {
          /* ignore */
        }
      }

      if (!metricsAvailable) return;
      try {
        if (req.path === '/metrics') return;
        const statusCode = res.statusCode || (aborted ? 499 : 0);
        const status = String(statusCode);
        const durSec =
          Number((process.hrtime.bigint() - start) / 1_000_000n) / 1000;
        httpRequestDuration.observe({ method, route, status }, durSec);
        httpRequestsTotal.inc({ method, route, status });
        if (status.startsWith('5')) {
          httpRequests5xx.inc({ route });
        }
        if (!aborted) {
          const reqLen = Number(req.get('content-length') || 0);
          if (reqLen > 0) {
            httpRequestSize.observe({ method, route }, reqLen);
          }
          const resLen = Number(res.getHeader('content-length') || 0);
          if (resLen > 0) {
            httpResponseSize.observe({ method, route, status }, resLen);
          }
        }
      } catch {
        /* ignore metric errors */
      }
    };

    res.once('finish', () => finalize(false));
    res.once('close', () => finalize(true));
    next();
  };
}

export async function withJobMetrics(job, fn) {
  await ensureInit();
  const start = Date.now();
  // Lazy job audit (persisted in DB)
  let runId = null;
  let jobLogSvc = null;
  try {
    jobLogSvc = (await import('../services/jobLogService.js')).default;
    if (jobLogSvc?.createJobRun) runId = await jobLogSvc.createJobRun(job);
  } catch (_e) {
    /* ignore */
  }
  const finishJobRun =
    jobLogSvc && typeof jobLogSvc.finishJobRun === 'function'
      ? jobLogSvc.finishJobRun.bind(jobLogSvc)
      : null;
  if (metricsAvailable) {
    jobInProgress.set({ job }, 1);
    jobLastRun.set({ job }, Math.floor(start / 1000));
  }
  try {
    const result = await fn();
    if (metricsAvailable) {
      const sec = (Date.now() - start) / 1000;
      jobRuns.inc({ job, status: 'success' });
      jobDuration.observe({ job }, sec);
      jobLastSuccess.set({ job }, Math.floor(Date.now() / 1000));
      jobInProgress.set({ job }, 0);
    }
    try {
      if (finishJobRun)
        await finishJobRun(runId, {
          status: 'SUCCESS',
          durationMs: Date.now() - start,
        });
    } catch (_e) {
      /* ignore */
    }
    return result;
  } catch (err) {
    if (metricsAvailable) {
      const sec = (Date.now() - start) / 1000;
      jobRuns.inc({ job, status: 'error' });
      jobDuration.observe({ job }, sec);
      jobInProgress.set({ job }, 0);
    }
    try {
      if (finishJobRun)
        await finishJobRun(runId, {
          status: 'ERROR',
          durationMs: Date.now() - start,
          error: err?.stack || err?.message || String(err),
        });
    } catch (_e) {
      /* ignore */
    }
    throw err;
  }
}

// Optionally preseed known job metrics so series exist from startup.
export async function seedJobMetrics(jobs = []) {
  await ensureInit();
  if (!metricsAvailable) return;
  try {
    for (const job of jobs) {
      // Set in-progress to 0 so gauge appears; last_run/last_success are set on first run
      jobInProgress.set({ job }, 0);
    }
  } catch {
    /* ignore metric errors */
  }
}

export async function metricsText() {
  await ensureInit();
  if (!metricsAvailable) {
    return '# metrics disabled: prom-client not installed\n';
  }
  return register.metrics();
}

// Return concise stats for selected jobs from the registry
export async function getJobStats(jobs = []) {
  await ensureInit();
  const unique = Array.from(new Set(jobs.filter(Boolean)));
  const result = {};
  if (!metricsAvailable) {
    for (const j of unique)
      result[j] = {
        in_progress: null,
        last_run: null,
        last_success: null,
        runs: { success: 0, error: 0 },
      };
    return result;
  }
  const mInProg = register.getSingleMetric('job_in_progress');
  const mLastRun = register.getSingleMetric('job_last_run_timestamp_seconds');
  const mLastOk = register.getSingleMetric(
    'job_last_success_timestamp_seconds'
  );
  const mRuns = register.getSingleMetric('job_runs_total');
  for (const j of unique) {
    const findVal = (metric, labels) => {
      try {
        if (!metric) return null;
        const data = metric.get();
        const hit = (data.values || []).find((v) => {
          const l = v.labels || {};
          return (
            l.job === labels.job &&
            (labels.status ? l.status === labels.status : true)
          );
        });
        return hit ? hit.value : null;
      } catch {
        return null;
      }
    };
    const inProg = findVal(mInProg, { job: j });
    const lastRun = findVal(mLastRun, { job: j });
    const lastOk = findVal(mLastOk, { job: j });
    const success = findVal(mRuns, { job: j, status: 'success' }) || 0;
    const error = findVal(mRuns, { job: j, status: 'error' }) || 0;
    result[j] = {
      in_progress: typeof inProg === 'number' ? Number(inProg) : 0,
      last_run: typeof lastRun === 'number' ? Number(lastRun) : null,
      last_success: typeof lastOk === 'number' ? Number(lastOk) : null,
      runs: { success: Number(success), error: Number(error) },
    };
  }
  return result;
}

export function setBuildInfo({
  service = 'api',
  version = '0.0.0',
  env = 'dev',
  commit = 'unknown',
} = {}) {
  if (!metricsAvailable) return;
  try {
    appBuildInfo.set({ service, version, env, commit }, 1);
  } catch (_e) {
    /* ignore */
  }
}

export function setAppReady(val) {
  if (!metricsAvailable) return;
  try {
    _appReadyState = !!val;
    appReadyGauge.set(val ? 1 : 0);
  } catch (_e) {
    /* ignore */
  }
}

export function setAppSyncing(val) {
  if (!metricsAvailable) return;
  try {
    _appSyncingState = !!val;
    appSyncingGauge.set(val ? 1 : 0);
  } catch (_e) {
    /* ignore */
  }
}

export function setDbUp(val) {
  if (!metricsAvailable) return;
  try {
    _dbUpState = !!val;
    dbUpGauge.set(val ? 1 : 0);
  } catch (_e) {
    /* ignore */
  }
}

export function setCacheUp(val) {
  if (!metricsAvailable) return;
  try {
    _cacheUpState = !!val;
    cacheUpGauge.set(val ? 1 : 0);
  } catch (_e) {
    /* ignore */
  }
}

export function observeDbQuery(operation, ms) {
  if (!metricsAvailable) return;
  try {
    dbQueryDuration.observe({ operation }, ms / 1000);
  } catch (_e) {
    /* ignore */
  }
}

export function startSequelizePoolCollector(sequelize) {
  if (!metricsAvailable || !sequelize?.connectionManager?.pool) return;
  const pool = sequelize.connectionManager.pool;
  const collect = () => {
    try {
      const size = typeof pool.size === 'function' ? pool.size : pool.size || 0;
      const avail =
        typeof pool.available === 'function'
          ? pool.available
          : pool.available || 0;
      const pending =
        typeof pool.pending === 'function'
          ? pool.pending
          : pool.pending || pool.waitingCount || 0;
      dbPoolSize.set(Number(size));
      dbPoolFree.set(Number(avail));
      dbPoolPending.set(Number(pending));
    } catch (_e) {
      /* ignore */
    }
  };
  collect();
  const interval = setInterval(collect, 5000);
  if (interval?.unref) interval.unref();
}

export default { withJobMetrics, metricsText, seedJobMetrics, getJobStats };

export function getRuntimeStates() {
  return {
    appReady: _appReadyState,
    appSyncing: _appSyncingState,
    dbUp: _dbUpState,
    cacheUp: _cacheUpState,
  };
}

// Auth & mail helpers
export function incAuthLogin(result) {
  if (!metricsAvailable) return;
  try {
    authLoginAttempts.inc({ result });
  } catch (_e) {
    /* noop */
  }
}
export function incAuthRefresh(result) {
  if (!metricsAvailable) return;
  try {
    authRefreshTotal.inc({ result });
  } catch (_e) {
    /* noop */
  }
}
export function incTokenIssued(type) {
  if (!metricsAvailable) return;
  try {
    tokensIssued.inc({ type });
  } catch (_e) {
    /* noop */
  }
}
export function incEmailSent(status, purpose = 'generic') {
  if (!metricsAvailable) return;
  try {
    emailSentTotal.inc({ status, purpose });
  } catch (_e) {
    /* noop */
  }
}

export function incRateLimited(name = 'global') {
  if (!metricsAvailable) return;
  try {
    rateLimitedTotal.inc({ name });
  } catch (_e) {
    /* noop */
  }
}

export function incCsrfAccepted(mode = 'cookie') {
  if (!metricsAvailable) return;
  try {
    csrfAcceptedTotal.inc({ mode });
  } catch (_e) {
    /* noop */
  }
}

export function incCsrfRejected(reason = 'other') {
  if (!metricsAvailable) return;
  try {
    csrfRejectedTotal.inc({ reason });
  } catch (_e) {
    /* noop */
  }
}

export function incHttpErrorCode(code = 'error', status = 0) {
  if (!metricsAvailable) return;
  try {
    const s = String(status || 0);
    httpErrorCodeTotal.inc({ code: String(code), status: s });
  } catch (_e) {
    /* noop */
  }
}

export function incRefreshReuse(result = 'detected') {
  if (!metricsAvailable) return;
  try {
    refreshReuseDetected.inc({ result });
  } catch (_e) {
    /* noop */
  }
}

export function incSecurityEvent(type = 'reuse') {
  if (!metricsAvailable) return;
  try {
    securityEvents.inc({ type });
  } catch (_e) {
    /* noop */
  }
}
