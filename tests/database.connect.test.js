import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const setDbUp = jest.fn();
const startPoolCollector = jest.fn();
const loggerInfo = jest.fn();
const loggerError = jest.fn();

let failAuth = false;

jest.unstable_mockModule('sequelize', () => {
  class Sequelize {
    constructor() {
      this.query = jest.fn(async () => {});
      this.close = jest.fn(async () => {});
    }
    async authenticate() {
      if (failAuth) throw new Error('boom');
      return true;
    }
  }
  return { __esModule: true, Sequelize };
});

jest.unstable_mockModule('../logger.js', () => ({
  __esModule: true,
  default: {
    info: loggerInfo,
    error: loggerError,
  },
}));

jest.unstable_mockModule('../src/config/metrics.js', () => ({
  __esModule: true,
  setDbUp,
  startSequelizePoolCollector: startPoolCollector,
  observeDbQuery: jest.fn(),
}));

const { connectToDatabase, closeDatabase } =
  await import('../src/config/database.js');

beforeEach(() => {
  failAuth = false;
  setDbUp.mockReset();
  startPoolCollector.mockReset();
  loggerInfo.mockReset();
  loggerError.mockReset();
});

afterEach(async () => {
  await closeDatabase();
});

test('connectToDatabase marks db up and starts pool collector on success', async () => {
  await expect(connectToDatabase()).resolves.toBeUndefined();
  expect(loggerInfo).toHaveBeenCalled();
  expect(setDbUp).toHaveBeenCalledWith(true);
  expect(startPoolCollector).toHaveBeenCalled();
});

test('connectToDatabase marks db down and throws on failure', async () => {
  failAuth = true;
  await expect(connectToDatabase()).rejects.toThrow(
    'Unable to connect to database'
  );
  expect(loggerError).toHaveBeenCalled();
  expect(setDbUp).toHaveBeenCalledWith(false);
});
