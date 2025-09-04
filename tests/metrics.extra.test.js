import { expect, test } from '@jest/globals';

const { getJobStats, seedJobMetrics } = await import(
  '../src/config/metrics.js'
);

test('getJobStats returns consistent keys when metrics disabled or enabled', async () => {
  const res = await getJobStats(['a', 'a', 'b']);
  expect(Object.keys(res)).toEqual(['a', 'b']);
  // in_progress may be 0 (enabled) or null (disabled); last_* may be null
  expect(res.a).toHaveProperty('in_progress');
  expect(res.a).toHaveProperty('last_run');
  expect(res.a).toHaveProperty('last_success');
  expect(res.a).toHaveProperty('runs');
  expect(res.a.runs).toEqual({
    success: expect.any(Number),
    error: expect.any(Number),
  });
});

test('seedJobMetrics does not throw when metrics disabled', async () => {
  await expect(seedJobMetrics(['x', 'y'])).resolves.toBeUndefined();
});
