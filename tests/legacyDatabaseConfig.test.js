import { expect, jest, test } from '@jest/globals';

test('connectLegacyDatabase sets availability true on success', async () => {
  jest.resetModules();
  const query = jest.fn().mockResolvedValue([[]]);
  jest.unstable_mockModule('mysql2/promise', () => ({
    __esModule: true,
    default: { createPool: () => ({ query }) },
    createPool: () => ({ query }),
  }));
  const mod = await import('../src/config/legacyDatabase.js');
  await mod.connectLegacyDatabase();
  expect(mod.isLegacyDbAvailable()).toBe(true);
});

test('connectLegacyDatabase sets availability false on error', async () => {
  jest.resetModules();
  const query = jest.fn().mockRejectedValue(new Error('nope'));
  jest.unstable_mockModule('mysql2/promise', () => ({
    __esModule: true,
    default: { createPool: () => ({ query }) },
    createPool: () => ({ query }),
  }));
  const mod = await import('../src/config/legacyDatabase.js');
  await mod.connectLegacyDatabase();
  expect(mod.isLegacyDbAvailable()).toBe(false);
});
