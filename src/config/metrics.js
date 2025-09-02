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

async function ensureInit() {
  if (metricsAvailable || register !== null) return;
  try {
    const mod = await import('prom-client');
    client = mod;
    register = new client.Registry();
    // Default metrics
    client.collectDefaultMetrics({ register });

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
    metricsAvailable = true;
  } catch {
    // prom-client not available; metrics disabled
    client = null;
    register = null;
    metricsAvailable = false;
  }
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
  } catch {
    /* ignore */
  }
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
      if (jobLogSvc?.finishJobRun)
        await jobLogSvc.finishJobRun(runId, {
          status: 'SUCCESS',
          durationMs: Date.now() - start,
        });
    } catch {
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
      if (jobLogSvc?.finishJobRun)
        await jobLogSvc.finishJobRun(runId, {
          status: 'ERROR',
          durationMs: Date.now() - start,
          error: err?.stack || err?.message || String(err),
        });
    } catch {
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

export default { withJobMetrics, metricsText, seedJobMetrics, getJobStats };
