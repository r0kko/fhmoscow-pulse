import {expect, jest, test} from '@jest/globals';

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

// eslint-disable-next-line no-undef
process.env.DB_NAME = 'db';
// eslint-disable-next-line no-undef
process.env.DB_USER = 'user';
// eslint-disable-next-line no-undef
process.env.DB_PASS = 'pass';
// eslint-disable-next-line no-undef
process.env.DB_HOST = 'localhost';
// eslint-disable-next-line no-undef
process.env.DB_PORT = '5432';

const {
  connectToDatabase,
  closeDatabase,
} = await import('../src/config/database.js');

test('connectToDatabase authenticates', async () => {
  await connectToDatabase();
  expect(authenticateMock).toHaveBeenCalled();
});

test('connectToDatabase exits on failure', async () => {
  authenticateMock.mockRejectedValueOnce(new Error('fail'));
  // eslint-disable-next-line no-undef
  const exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});
  await connectToDatabase();
  expect(exitMock).toHaveBeenCalledWith(1);
  exitMock.mockRestore();
});

test('closeDatabase closes connection', async () => {
  await closeDatabase();
  expect(closeMock).toHaveBeenCalled();
});
