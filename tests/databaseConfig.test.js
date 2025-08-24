/* global process */
import { afterEach, beforeEach, expect, test, jest } from '@jest/globals';

const origEnv = { ...process.env };

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  process.env = { ...origEnv };
});

test('sequelize logging is enabled in development', async () => {
  process.env.NODE_ENV = 'development';
  const { default: sequelize } = await import('../src/config/database.js');
  expect(typeof sequelize.options.logging).toBe('function');
});

test('sequelize logging is disabled outside development', async () => {
  process.env.NODE_ENV = 'production';
  const { default: sequelize } = await import('../src/config/database.js');
  expect(sequelize.options.logging).toBe(false);
});
