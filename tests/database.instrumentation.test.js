import { beforeEach, expect, jest, test } from '@jest/globals';

const authenticateMock = jest.fn();
const closeMock = jest.fn();
const queryMock = jest.fn();
const transactionMock = jest.fn();
const observeDbQueryMock = jest.fn();
const setDbUpMock = jest.fn();
const startCollectorMock = jest.fn();
const infoMock = jest.fn();
const errorMock = jest.fn();

let sequelizeInstance;

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function loadDatabaseModule() {
  const mod = await import('../src/config/database.js');
  return {
    connectToDatabase: mod.connectToDatabase,
    closeDatabase: mod.closeDatabase,
    sequelize: mod.default,
  };
}

beforeEach(() => {
  jest.resetModules();
  authenticateMock.mockReset().mockResolvedValue();
  closeMock.mockReset();
  queryMock.mockReset();
  transactionMock.mockReset().mockImplementation(async (fn) => fn());
  observeDbQueryMock.mockReset();
  setDbUpMock.mockReset();
  startCollectorMock.mockReset();
  infoMock.mockReset();
  errorMock.mockReset();

  sequelizeInstance = {
    authenticate: authenticateMock,
    close: closeMock,
    query: queryMock,
    transaction: transactionMock,
  };

  process.env.DB_NAME = 'db';
  process.env.DB_USER = 'user';
  process.env.DB_PASS = 'pass';
  process.env.DB_HOST = 'host';
  process.env.DB_PORT = '5432';

  jest.unstable_mockModule('sequelize', () => ({
    __esModule: true,
    Sequelize: jest.fn(() => sequelizeInstance),
  }));

  jest.unstable_mockModule('dotenv', () => ({
    __esModule: true,
    default: { config: jest.fn() },
  }));

  jest.unstable_mockModule('../logger.js', () => ({
    __esModule: true,
    default: { info: infoMock, error: errorMock },
  }));

  jest.unstable_mockModule('../src/config/metrics.js', () => ({
    __esModule: true,
    observeDbQuery: observeDbQueryMock,
    setDbUp: setDbUpMock,
    startSequelizePoolCollector: startCollectorMock,
  }));
});

function primeQuery({ succeed = true } = {}) {
  if (succeed) {
    queryMock.mockImplementationOnce(async (...args) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return ['ok', ...args];
    });
  } else {
    queryMock.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      throw new Error('broken');
    });
  }
}

test('connectToDatabase instruments queries and emits metrics', async () => {
  const { connectToDatabase, sequelize } = await loadDatabaseModule();
  await connectToDatabase();

  expect(authenticateMock).toHaveBeenCalled();
  expect(setDbUpMock).toHaveBeenCalledWith(true);
  expect(startCollectorMock).toHaveBeenCalledWith(sequelizeInstance);

  primeQuery({ succeed: true });
  const result = await sequelize.query('SELECT 1');
  await flushMicrotasks();
  expect(Array.isArray(result)).toBe(true);
  expect(queryMock).toHaveBeenCalledWith('SELECT 1', {});
  expect(observeDbQueryMock).toHaveBeenCalledWith('SELECT', expect.any(Number));

  primeQuery({ succeed: false });
  await expect(sequelize.query('UPDATE rules')).rejects.toThrow('broken');
  await flushMicrotasks();
  expect(observeDbQueryMock).toHaveBeenCalledWith('UPDATE', expect.any(Number));
});

test('connectToDatabase surfaces authentication failure and records outage', async () => {
  authenticateMock.mockRejectedValueOnce(new Error('nope'));
  const { connectToDatabase } = await loadDatabaseModule();
  await expect(connectToDatabase()).rejects.toThrow(
    'Unable to connect to database'
  );
  expect(errorMock).toHaveBeenCalledWith(
    '❌ Unable to connect to DB:',
    expect.any(Error)
  );
  expect(setDbUpMock).toHaveBeenCalledWith(false);
});
