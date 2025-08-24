/* global process */
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const origEnv = { ...process.env };

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  process.env = { ...origEnv };
});

test('env loads dotenv when not in test', async () => {
  process.env.NODE_ENV = 'production';
  const cfgMock = jest.fn();
  jest.unstable_mockModule('dotenv', () => ({ __esModule: true, default: { config: cfgMock } }));
  await import('../src/config/env.js');
  expect(cfgMock).toHaveBeenCalledWith({ quiet: true });
});

test('env skips dotenv in test', async () => {
  process.env.NODE_ENV = 'test';
  const cfgMock = jest.fn();
  jest.unstable_mockModule('dotenv', () => ({ __esModule: true, default: { config: cfgMock } }));
  await import('../src/config/env.js');
  expect(cfgMock).not.toHaveBeenCalled();
});
