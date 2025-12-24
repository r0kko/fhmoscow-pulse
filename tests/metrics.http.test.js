import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const counters = [];
const histograms = [];
const gauges = [];

class FakeCounter {
  constructor(opts) {
    this.opts = opts;
    this.inc = jest.fn();
    counters.push(this);
  }
}
class FakeHistogram {
  constructor(opts) {
    this.opts = opts;
    this.observe = jest.fn();
    histograms.push(this);
  }
}
class FakeGauge {
  constructor(opts) {
    this.opts = opts;
    this.inc = jest.fn();
    this.dec = jest.fn();
    this.set = jest.fn();
    gauges.push(this);
  }
}

jest.unstable_mockModule('prom-client', () => ({
  __esModule: true,
  Registry: class Registry {},
  Counter: FakeCounter,
  Histogram: FakeHistogram,
  Gauge: FakeGauge,
  collectDefaultMetrics: jest.fn(),
}));

const buildReqRes = (routePath, base = '') => {
  const res = {
    _status: 200,
    statusCode: 200,
    status(code) {
      this._status = code;
      this.statusCode = code;
      return this;
    },
    getHeader: () => 0,
    once: (event, cb) => {
      if (event === 'finish') {
        cb();
      }
    },
  };
  const req = {
    method: 'get',
    path: routePath,
    route: { path: routePath },
    baseUrl: base,
    get: () => 256,
  };
  return { req, res };
};

let metrics;

beforeEach(async () => {
  jest.resetModules();
  counters.length = 0;
  histograms.length = 0;
  gauges.length = 0;
  metrics = await import('../src/config/metrics.js');
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('httpMetricsMiddleware normalizes route labels and records sizes', async () => {
  await metrics.withJobMetrics('init', async () => {});
  const middleware = metrics.httpMetricsMiddleware();
  const { req, res } = buildReqRes('/users', '/legacy');
  res.getHeader = () => 128;
  await middleware(req, res, () => {});
  const durationHist = histograms.find(
    (h) => h.opts.name === 'http_request_duration_seconds'
  );
  expect(durationHist.observe).toHaveBeenCalledWith(
    expect.objectContaining({ method: 'GET', route: '/legacy/users' }),
    expect.any(Number)
  );
  const reqSize = histograms.find(
    (h) => h.opts.name === 'http_request_size_bytes'
  );
  expect(reqSize.observe).toHaveBeenCalled();
  const inflightGauge = gauges.find(
    (g) => g.opts.name === 'http_server_in_flight_requests'
  );
  expect(inflightGauge.inc).toHaveBeenCalledWith({
    method: 'GET',
    route: '/legacy/users',
  });
  expect(inflightGauge.dec).toHaveBeenCalledWith({
    method: 'GET',
    route: '/legacy/users',
  });
});
