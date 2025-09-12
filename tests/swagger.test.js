import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const save = { BASE_URL: process.env.BASE_URL };

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  process.env.BASE_URL = save.BASE_URL;
});

test('swagger uses local server when BASE_URL is not set', async () => {
  delete process.env.BASE_URL;
  const specModule = await import('../src/docs/swagger.js');
  const spec = specModule.default;
  expect(spec.openapi).toBe('3.0.3');
  expect(Array.isArray(spec.servers)).toBe(true);
  expect(spec.servers[0]).toMatchObject({
    url: 'http://localhost:3000',
    description: 'Local server',
  });
});

test('swagger uses production server when BASE_URL is set', async () => {
  process.env.BASE_URL = 'https://api.example.com';
  const specModule = await import('../src/docs/swagger.js');
  const spec = specModule.default;
  expect(spec.servers[0]).toMatchObject({
    url: 'https://api.example.com',
    description: 'Production server',
  });
});
