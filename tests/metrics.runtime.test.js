import { describe, expect, jest, test } from '@jest/globals';

// Stub prom-client so metrics are enabled and setters execute
jest.resetModules();
jest.unstable_mockModule('prom-client', () => ({
  __esModule: true,
  collectDefaultMetrics: () => {},
  Registry: class {
    metrics() {
      return '';
    }
  },
  Counter: class {
    constructor() {}
    inc() {}
  },
  Histogram: class {
    constructor() {}
    observe() {}
  },
  Gauge: class {
    constructor() {}
    set() {}
  },
}));

const {
  getRuntimeStates,
  setAppReady,
  setAppSyncing,
  setDbUp,
  setCacheUp,
  setBuildInfo,
  observeDbQuery,
  startSequelizePoolCollector,
  metricsText,
} = await import('../src/config/metrics.js');

describe('metrics runtime state helpers', () => {
  test('setters update getRuntimeStates', async () => {
    await metricsText();
    setAppReady(true);
    setAppSyncing(true);
    setDbUp(true);
    setCacheUp(true);
    const s1 = getRuntimeStates();
    expect(s1).toEqual({
      appReady: true,
      appSyncing: true,
      dbUp: true,
      cacheUp: true,
    });

    setAppReady(false);
    setAppSyncing(false);
    setDbUp(false);
    setCacheUp(false);
    const s2 = getRuntimeStates();
    expect(s2).toEqual({
      appReady: false,
      appSyncing: false,
      dbUp: false,
      cacheUp: false,
    });
  });

  test('build info and db query observers do not throw', () => {
    expect(() =>
      setBuildInfo({
        service: 'api',
        version: '1.2.3',
        env: 'test',
        commit: 'abc',
      })
    ).not.toThrow();
    expect(() => observeDbQuery('select', 12)).not.toThrow();
  });

  test('startSequelizePoolCollector works with numeric and function pool props', () => {
    const sequelize1 = {
      connectionManager: { pool: { size: 1, available: 1, pending: 0 } },
    };
    startSequelizePoolCollector(sequelize1);
    const sequelize2 = {
      connectionManager: {
        pool: { size: () => 2, available: () => 1, pending: () => 0 },
      },
    };
    startSequelizePoolCollector(sequelize2);
  });
});
