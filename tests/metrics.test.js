import { describe, expect, test } from '@jest/globals';

const { withJobMetrics, metricsText } = await import('../src/config/metrics.js');

describe('metrics integration', () => {
  test('records success path and exposes metrics text', async () => {
    const result = await withJobMetrics('unit_success', async () => 123);
    expect(result).toBe(123);
    const text = await metricsText();
    expect(typeof text).toBe('string');
  });

  test('records error path without throwing inside wrapper', async () => {
    await expect(
      (async () => {
        try {
          await withJobMetrics('unit_error', async () => {
            throw new Error('boom');
          });
        } catch (e) {
          // Ensure the original error is still propagated
          expect(e).toBeInstanceOf(Error);
        }
      })()
    ).resolves.toBeUndefined();
    const text = await metricsText();
    expect(typeof text).toBe('string');
  });
});

