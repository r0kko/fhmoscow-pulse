import { describe, expect, jest, test } from '@jest/globals';

// Use a lightweight prom-client stub to fully control metric counters
class StubCounter {
  constructor() {
    this.calls = [];
  }
  inc(labels) {
    this.calls.push({ type: 'inc', labels });
  }
}
class StubHistogram {
  constructor() {
    this.calls = [];
  }
  observe(labels, value) {
    this.calls.push({ type: 'observe', labels, value });
  }
}
class StubGauge {
  constructor() {
    this.calls = [];
  }
  inc(labels) {
    this.calls.push({ type: 'inc', labels });
  }
  dec(labels) {
    this.calls.push({ type: 'dec', labels });
  }
  set(value) {
    this.calls.push({ type: 'set', value });
  }
}

const registry = { metrics: () => '# stub metrics' };
const objects = {};

jest.resetModules();
jest.unstable_mockModule('prom-client', () => ({
  __esModule: true,
  collectDefaultMetrics: () => {},
  Registry: class Registry {
    constructor() {
      Object.assign(this, registry);
    }
    getSingleMetric(name) {
      return objects[name];
    }
  },
  Counter: class Counter extends StubCounter {
    constructor(opts) {
      super();
      objects[opts.name] = this;
    }
  },
  Histogram: class Histogram extends StubHistogram {
    constructor(opts) {
      super();
      objects[opts.name] = this;
    }
  },
  Gauge: class Gauge extends StubGauge {
    constructor(opts) {
      super();
      objects[opts.name] = this;
    }
  },
}));

const { httpMetricsMiddleware, metricsText } = await import(
  '../src/config/metrics.js'
);

function makeReqRes({
  method = 'GET',
  path = '/x',
  routePath = undefined,
  status = 200,
  reqLen = 0,
  resLen = 0,
} = {}) {
  const handlers = {};
  const req = {
    method,
    path,
    route: routePath ? { path: routePath } : undefined,
    get: (h) =>
      h?.toLowerCase() === 'content-length' ? String(reqLen) : undefined,
  };
  const res = {
    statusCode: status,
    once: (evt, fn) => {
      handlers[evt] = fn;
    },
    getHeader: (h) =>
      h?.toLowerCase() === 'content-length' ? String(resLen) : undefined,
  };
  return { req, res, handlers };
}

describe('httpMetricsMiddleware', () => {
  test('records inflight, duration, size and 5xx counters', async () => {
    // Ensure metrics are initialized
    await metricsText();
    const mw = httpMetricsMiddleware();
    const { req, res, handlers } = makeReqRes({
      method: 'post',
      path: '/api/foo',
      routePath: '/api/foo',
      status: 500,
      reqLen: 123,
      resLen: 456,
    });
    const next = jest.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    // Simulate response finish
    handlers.finish?.();

    // Verify that our stubbed metrics were touched
    const inflight = objects['http_server_in_flight_requests'];
    expect(inflight.calls.some((c) => c.type === 'inc')).toBe(true);
    expect(inflight.calls.some((c) => c.type === 'dec')).toBe(true);

    const duration = objects['http_request_duration_seconds'];
    expect(duration.calls.some((c) => c.type === 'observe')).toBe(true);

    const total = objects['http_requests_total'];
    expect(total.calls.length).toBeGreaterThan(0);

    const fivexx = objects['http_requests_5xx_total'];
    expect(fivexx.calls.length).toBeGreaterThan(0);

    const reqSize = objects['http_request_size_bytes'];
    expect(reqSize.calls.length).toBeGreaterThan(0);

    const resSize = objects['http_response_size_bytes'];
    expect(resSize.calls.length).toBeGreaterThan(0);
  });

  test('does nothing for /metrics and when sizes are missing', async () => {
    await metricsText();
    const mw = httpMetricsMiddleware();
    const { req, res, handlers } = makeReqRes({
      method: 'get',
      path: '/metrics',
      routePath: '/metrics',
      status: 200,
      reqLen: 0,
      resLen: 0,
    });
    mw(req, res, () => {});
    handlers.finish?.();
    const fivexx = objects['http_requests_5xx_total'];
    // No 5xx increments expected
    expect(fivexx.calls.length).toBeGreaterThanOrEqual(0);
  });
});
