import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const queryMock = jest.fn();
const isAvailableMock = jest.fn();
jest.unstable_mockModule('../src/config/legacyDatabase.js', () => ({
  default: { query: queryMock },
  isLegacyDbAvailable: isAvailableMock,
}));

const loggerErrorMock = jest.fn();
jest.unstable_mockModule('../logger.js', () => ({ default: { error: loggerErrorMock } }));

const { findByEmail, findById } = await import(
  '../src/services/legacyUserService.js'
);

beforeEach(() => {
  queryMock.mockReset();
  isAvailableMock.mockReset();
  loggerErrorMock.mockReset();
});

describe('legacyUserService', () => {
  test('returns null when legacy DB unavailable', async () => {
    isAvailableMock.mockReturnValue(false);
    const result = await findByEmail('test@example.com');
    expect(result).toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });

  test('findByEmail returns row when available', async () => {
    isAvailableMock.mockReturnValue(true);
    queryMock.mockResolvedValue([[{ id: 1 }]]);
    const res = await findByEmail('a@b');
    expect(res).toEqual({ id: 1 });
    expect(queryMock).toHaveBeenCalled();
  });

  test('findByEmail logs and returns null on error', async () => {
    isAvailableMock.mockReturnValue(true);
    queryMock.mockRejectedValue(new Error('db fail'));
    const res = await findByEmail('a@b');
    expect(res).toBeNull();
    expect(loggerErrorMock).toHaveBeenCalled();
  });

  test('findById mirrors findByEmail', async () => {
    isAvailableMock.mockReturnValue(true);
    queryMock.mockResolvedValue([[{ id: 2 }]]);
    const res = await findById('2');
    expect(res).toEqual({ id: 2 });
  });
});

