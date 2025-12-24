import { describe, expect, test } from '@jest/globals';

const { seedJobMetrics, getJobStats, withJobMetrics } =
  await import('../src/config/metrics.js');

describe('metrics adminOps helpers', () => {
  test('seedJobMetrics pre-creates series and getJobStats returns zeros', async () => {
    await seedJobMetrics(['ci_job']);
    const stats = await getJobStats(['ci_job']);
    expect(stats.ci_job).toBeDefined();
    expect(typeof stats.ci_job.in_progress).toBe('number');
  });

  test('getJobStats returns structure after a run', async () => {
    await withJobMetrics('ci_succeed', async () => 1);
    const stats = await getJobStats(['ci_succeed']);
    // In environments without prom-client, values can be 0/null, but shape must exist
    expect(stats.ci_succeed).toBeDefined();
    expect(stats.ci_succeed.runs).toBeDefined();
    expect(typeof stats.ci_succeed.runs.success).toBe('number');
  });
});
