import { afterEach, expect, jest, test } from '@jest/globals';

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  jest.resetModules();
});

async function loadConfig(overrides = {}) {
  process.env = { ...baseEnv, ...overrides };
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    }
  });
  jest.resetModules();
  return import('../src/config/externalS3.js');
}

test('formats endpoint without protocol and exposes bucket getter', async () => {
  const cfg = await loadConfig({
    EXT_S3_ENDPOINT: 'files.internal',
    EXT_S3_BUCKET: 'docs',
  });
  expect(cfg.EXT_S3_ENDPOINT).toBe('https://files.internal');
  expect(cfg.getExternalS3Bucket()).toBe('docs');
});

test('keeps provided protocol untouched', async () => {
  const cfg = await loadConfig({
    EXT_S3_ENDPOINT: 'http://edge.example',
    EXT_S3_BUCKET: 'media',
  });
  expect(cfg.EXT_S3_ENDPOINT).toBe('http://edge.example');
  expect(cfg.getExternalS3Bucket()).toBe('media');
});

test('handles missing optional configuration gracefully', async () => {
  const cfg = await loadConfig({
    EXT_S3_ENDPOINT: '',
    EXT_S3_BUCKET: undefined,
  });
  expect(cfg.EXT_S3_ENDPOINT).toBeUndefined();
  expect(cfg.getExternalS3Bucket()).toBeUndefined();
});
