import { expect, jest, test } from '@jest/globals';

const authenticateMock = jest.fn();
const closeMock = jest.fn();
const SequelizeMock = jest.fn(() => ({
  authenticate: authenticateMock,
  close: closeMock,
}));

jest.unstable_mockModule('sequelize', () => ({
  __esModule: true,
  Sequelize: SequelizeMock,
}));

jest.unstable_mockModule('dotenv', () => ({
  __esModule: true,
  default: { config: jest.fn() },
}));

const infoMock = jest.fn();
const errorMock = jest.fn();
jest.unstable_mockModule('../logger.js', () => ({
  __esModule: true,
  default: { info: infoMock, error: errorMock },
}));

process.env.DB_NAME = 'db';

process.env.DB_USER = 'user';

process.env.DB_PASS = 'pass';

process.env.DB_HOST = 'localhost';

process.env.DB_PORT = '5432';

const { connectToDatabase, closeDatabase } = await import(
  '../src/config/database.js'
);

test('connectToDatabase authenticates', async () => {
  await connectToDatabase();
  expect(authenticateMock).toHaveBeenCalled();
});

test('connectToDatabase surfaces failure', async () => {
  authenticateMock.mockRejectedValueOnce(new Error('fail'));

  await expect(connectToDatabase()).rejects.toThrow(
    'Unable to connect to database'
  );
  expect(errorMock).toHaveBeenCalledWith(
    '❌ Unable to connect to DB:',
    expect.any(Error)
  );
});

test('closeDatabase closes connection', async () => {
  await closeDatabase();
  expect(closeMock).toHaveBeenCalled();
});
