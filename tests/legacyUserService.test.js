import { describe, expect, jest, test } from '@jest/globals';

const queryMock = jest.fn();
jest.unstable_mockModule('../src/config/legacyDatabase.js', () => ({
  default: { query: queryMock },
  isLegacyDbAvailable: jest.fn(() => false),
}));

const { findByEmail } = await import('../src/services/legacyUserService.js');

describe('legacyUserService', () => {
  test('returns null when legacy DB unavailable', async () => {
    const result = await findByEmail('test@example.com');
    expect(result).toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });
});
