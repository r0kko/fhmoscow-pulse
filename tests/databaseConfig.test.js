/* global process */
import { afterEach, beforeEach, expect, test, jest } from '@jest/globals';

const origEnv = { ...process.env };
let loadedDatabaseModule;

beforeEach(() => {
  jest.resetModules();
});

afterEach(async () => {
  await loadedDatabaseModule?.closeDatabase?.();
  loadedDatabaseModule = undefined;
  process.env = { ...origEnv };
});

test('sequelize logging is enabled in development', async () => {
  process.env.NODE_ENV = 'development';
  loadedDatabaseModule = await import('../src/config/database.js');
  const { default: sequelize } = loadedDatabaseModule;
  expect(typeof sequelize.options.logging).toBe('function');
});

test('sequelize logging is disabled outside development', async () => {
  process.env.NODE_ENV = 'production';
  loadedDatabaseModule = await import('../src/config/database.js');
  const { default: sequelize } = loadedDatabaseModule;
  expect(sequelize.options.logging).toBe(false);
});
