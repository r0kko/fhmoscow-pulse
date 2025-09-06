import { beforeAll, expect, test } from '@jest/globals';

const metrics = await import('../src/config/metrics.js');

beforeAll(async () => {
  // Initialize metrics registry
  await metrics.metricsText();
});

test('auth and mail counters increment without throwing', () => {
  expect(() => metrics.incAuthLogin('success')).not.toThrow();
  expect(() => metrics.incAuthRefresh('invalid')).not.toThrow();
  expect(() => metrics.incTokenIssued('access')).not.toThrow();
  expect(() => metrics.incEmailSent('ok', 'verification')).not.toThrow();
  expect(() => metrics.incRateLimited('global')).not.toThrow();
  expect(() => metrics.incCsrfAccepted('cookie')).not.toThrow();
  expect(() => metrics.incCsrfRejected('hmac_error')).not.toThrow();
  expect(() => metrics.incHttpErrorCode('EBADCSRFTOKEN', 403)).not.toThrow();
});
