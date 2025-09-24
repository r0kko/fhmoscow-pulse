import {
  jest,
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

describe('config/cors', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test('splits and normalizes allowed origins from env', async () => {
    process.env.ALLOWED_ORIGINS = 'https://a.example, https://b.example , ,';
    const { ALLOWED_ORIGINS } = await import('../src/config/cors.js');
    expect(ALLOWED_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
  });

  test('falls back to empty array when env missing', async () => {
    delete process.env.ALLOWED_ORIGINS;
    const { ALLOWED_ORIGINS } = await import('../src/config/cors.js');
    expect(ALLOWED_ORIGINS).toEqual([]);
  });
});
