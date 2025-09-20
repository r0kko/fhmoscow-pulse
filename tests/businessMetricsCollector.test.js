import { beforeEach, expect, jest, test } from '@jest/globals';

const queryMock = jest.fn();

async function loadMetrics() {
  jest.unstable_mockModule('../src/config/database.js', () => ({
    __esModule: true,
    default: { query: queryMock },
  }));

  return import('../src/config/metrics.js');
}

beforeEach(() => {
  jest.resetModules();
  queryMock.mockReset();
  delete process.env.BUSINESS_METRICS_REFRESH_MS;
  process.env.NODE_ENV = 'test';
});

test('business metrics collector populates gauges from aggregated queries', async () => {
  queryMock
    .mockResolvedValueOnce([
      { status_alias: 'ACTIVE', status_label: 'Active', count: '10' },
      { status_alias: 'BLOCKED', status_label: 'Blocked', count: '2' },
    ])
    .mockResolvedValueOnce([
      {
        status_alias: 'PENDING_SIGNATURE',
        status_label: 'Awaiting signature',
        count: '5',
      },
      { status_alias: 'SIGNED', status_label: 'Signed', count: '20' },
    ])
    .mockResolvedValueOnce([{ gt3: '3', gt7: '1' }])
    .mockResolvedValueOnce([
      {
        today: '1',
        next7: '2',
        beyond7: '1',
        unscheduled: '0',
        overdue: '1',
      },
    ])
    .mockResolvedValueOnce([
      {
        today: '2',
        next7: '1',
        future: '4',
        needs_attendance: '1',
      },
    ]);

  process.env.BUSINESS_METRICS_REFRESH_MS = '120000';

  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  const metrics = await loadMetrics();
  await metrics.startBusinessMetricsCollector();
  jest.clearAllTimers();
  jest.useRealTimers();

  metrics.setAppReady(true);
  metrics.setAppSyncing(false);
  metrics.setDbUp(true);
  metrics.setCacheUp(true);
  metrics.incRateLimited('login');
  metrics.incCsrfRejected('cookie_mismatch');
  metrics.incCsrfAccepted('cookie');
  metrics.incHttpErrorCode('maintenance', 503);
  metrics.incSecurityEvent('lockout');
  metrics.incEmailQueueRetry('digest');
  metrics.incEmailQueueFailure('digest');
  metrics.setEmailQueueDepthBucket('ready', 5);
  metrics.observeDbQuery('SELECT', 12);

  const text = await metrics.metricsText();
  expect(text).toMatch(
    /business_users_total\{status="active",status_label="Active"} 10/
  );
  expect(text).toMatch(
    /business_users_total\{status="total",status_label="Total"} 12/
  );
  expect(text).toMatch(/business_documents_pending_total 5/);
  expect(text).toMatch(/business_documents_overdue_total\{bucket="gt_3d"} 3/);
  expect(text).toMatch(/business_matches_upcoming_total\{window="total"} 5/);
  expect(text).toMatch(/business_trainings_upcoming_total\{window="future"} 4/);
});
