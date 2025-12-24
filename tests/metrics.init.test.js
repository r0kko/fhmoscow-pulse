import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const counters = [];
const gauges = [];
const histograms = [];

class FakeCounter {
  constructor(opts) {
    this.opts = opts;
    this.inc = jest.fn();
    counters.push(this);
  }
}
class FakeGauge {
  constructor(opts) {
    this.opts = opts;
    this.set = jest.fn();
    gauges.push(this);
  }
}
class FakeHistogram {
  constructor(opts) {
    this.opts = opts;
    this.observe = jest.fn();
    histograms.push(this);
  }
}

jest.unstable_mockModule('prom-client', () => ({
  __esModule: true,
  Registry: class Registry {},
  Counter: FakeCounter,
  Gauge: FakeGauge,
  Histogram: FakeHistogram,
  collectDefaultMetrics: jest.fn(),
}));

jest.unstable_mockModule('../src/services/jobLogService.js', () => ({
  __esModule: true,
  default: {
    createJobRun: jest.fn().mockResolvedValue('run-1'),
    finishJobRun: jest.fn().mockResolvedValue(undefined),
  },
}));

let metrics;

beforeEach(async () => {
  jest.resetModules();
  counters.length = 0;
  gauges.length = 0;
  histograms.length = 0;
  metrics = await import('../src/config/metrics.js');
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('metrics bootstrap and collectors', () => {
  test('withJobMetrics initializes client and records success', async () => {
    await metrics.withJobMetrics('demo', async () => 'ok');
    const runs = counters.find((c) => c.opts.name === 'job_runs_total');
    expect(runs.inc).toHaveBeenCalledWith({ job: 'demo', status: 'success' });
    const lastRun = gauges.find(
      (g) => g.opts.name === 'job_last_run_timestamp_seconds'
    );
    expect(lastRun.set).toHaveBeenCalled();
  });

  test('set build/app/db/cache flags toggle gauges and runtime state', async () => {
    await metrics.withJobMetrics('noop', async () => {});
    metrics.setBuildInfo({
      service: 'api',
      version: '1.0.0',
      env: 'prod',
      commit: 'abc',
    });
    metrics.setAppReady(true);
    metrics.setAppSyncing(true);
    metrics.setDbUp(true);
    metrics.setCacheUp(false);
    const buildGauge = gauges.find((g) => g.opts.name === 'app_build_info');
    expect(buildGauge.set).toHaveBeenCalledWith(
      { service: 'api', version: '1.0.0', env: 'prod', commit: 'abc' },
      1
    );
    const states = metrics.getRuntimeStates();
    expect(states).toMatchObject({
      appReady: true,
      appSyncing: true,
      dbUp: true,
      cacheUp: false,
    });
  });

  test('db query/ pool collectors push observations', async () => {
    await metrics.withJobMetrics('db', async () => {});
    metrics.observeDbQuery('SELECT', 250);
    const hist = histograms.find(
      (h) => h.opts.name === 'db_query_duration_seconds'
    );
    expect(hist.observe).toHaveBeenCalledWith({ operation: 'SELECT' }, 0.25);

    const pool = {
      size: 5,
      available: 3,
      pending: 2,
      waitingCount: 0,
    };
    // start collector and advance timers
    metrics.startSequelizePoolCollector({ connectionManager: { pool } });
    jest.runOnlyPendingTimers();
    const sizeGauge = gauges.find((g) => g.opts.name === 'db_pool_size');
    expect(sizeGauge.set).toHaveBeenCalledWith(5);
  });
});
