import { beforeEach, expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const updateByInnMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findOne: findOneMock },
  Inn: {},
  Taxation: {},
}));

jest.unstable_mockModule('../src/services/taxationService.js', () => ({
  __esModule: true,
  default: { updateByInn: updateByInnMock },
}));

jest.unstable_mockModule('../logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { runTaxationCheck } = await import('../src/jobs/taxationCron.js');

beforeEach(() => {
  findOneMock.mockReset();
  updateByInnMock.mockReset();
});

test('updates taxation for next user with inn', async () => {
  findOneMock.mockResolvedValue({ id: 'u1', Inn: { number: '123' } });
  await runTaxationCheck();
  expect(updateByInnMock).toHaveBeenCalledWith('u1', '123', null);
});

test('does nothing when no user found', async () => {
  findOneMock.mockResolvedValue(null);
  await runTaxationCheck();
  expect(updateByInnMock).not.toHaveBeenCalled();
});
