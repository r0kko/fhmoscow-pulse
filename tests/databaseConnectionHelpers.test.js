import { expect, test, jest } from '@jest/globals';

test('connectToDatabase and closeDatabase can be invoked (happy path)', async () => {
  const mod = await import('../src/config/database.js');
  const sequelize = mod.default;

  // Stub authenticate/close to avoid real I/O
  const authSpy = jest
    .spyOn(sequelize, 'authenticate')
    .mockResolvedValueOnce(undefined);
  const closeSpy = jest
    .spyOn(sequelize, 'close')
    .mockResolvedValueOnce(undefined);

  await expect(mod.connectToDatabase()).resolves.toBeUndefined();
  await expect(mod.closeDatabase()).resolves.toBeUndefined();

  expect(authSpy).toHaveBeenCalled();
  expect(closeSpy).toHaveBeenCalled();
});
