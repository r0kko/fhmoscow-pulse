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
    return result;
  } catch (err) {
    if (metricsAvailable) {
      const sec = (Date.now() - start) / 1000;
      jobRuns.inc({ job, status: 'error' });
      jobDuration.observe({ job }, sec);
      jobInProgress.set({ job }, 0);
    }
    throw err;
  }
}

export async function metricsText() {
  await ensureInit();
  if (!metricsAvailable) {
    return '# metrics disabled: prom-client not installed\n';
  }
  return register.metrics();
}

export default { withJobMetrics, metricsText };
