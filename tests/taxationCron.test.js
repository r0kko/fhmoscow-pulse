import { beforeEach, expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const fetchByInnMock = jest.fn();
const updateByInnMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findOne: findOneMock },
  Inn: {},
  Taxation: {},
}));

jest.unstable_mockModule('../src/services/taxationService.js', () => ({
  __esModule: true,
  default: { fetchByInn: fetchByInnMock, updateByInn: updateByInnMock },
}));

jest.unstable_mockModule('../logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

const { runTaxationCheck } = await import('../src/jobs/taxationCron.js');

beforeEach(() => {
  findOneMock.mockReset();
  fetchByInnMock.mockReset();
  updateByInnMock.mockReset();
});

test('updates taxation for next user with inn when APIs succeed', async () => {
  findOneMock.mockResolvedValue({ id: 'u1', Inn: { number: '123' } });
  const data = {
    TaxationType: { id: 1 },
    check_date: '2024-01-01',
    registration_date: null,
    ogrn: null,
    okved: null,
    statuses: { dadata: 200, fns: 200 },
  };
  fetchByInnMock.mockResolvedValue(data);
  await runTaxationCheck();
  expect(updateByInnMock).toHaveBeenCalledWith('u1', '123', null, data);
});

test('skips update when any API fails', async () => {
  findOneMock.mockResolvedValue({ id: 'u1', Inn: { number: '123' } });
  fetchByInnMock.mockResolvedValue({ statuses: { dadata: 500, fns: 200 } });
  await runTaxationCheck();
  expect(updateByInnMock).not.toHaveBeenCalled();
});

test('does nothing when no user found', async () => {
  findOneMock.mockResolvedValue(null);
  await runTaxationCheck();
  expect(fetchByInnMock).not.toHaveBeenCalled();
  expect(updateByInnMock).not.toHaveBeenCalled();
});
