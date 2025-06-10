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

process.env.DB_NAME = 'db';
process.env.DB_USER = 'user';
process.env.DB_PASS = 'pass';
process.env.DB_HOST = 'localhost';
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
  const exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});
  await connectToDatabase();
  expect(exitMock).toHaveBeenCalledWith(1);
  exitMock.mockRestore();
});

test('closeDatabase closes connection', async () => {
  await closeDatabase();
  expect(closeMock).toHaveBeenCalled();
});
