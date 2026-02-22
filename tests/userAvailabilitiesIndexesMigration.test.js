import { expect, jest, test } from '@jest/globals';

const migration = (
  await import('../src/migrations/20260222100000-add-user-availabilities-active-indexes.js')
).default;

test('user availabilities indexes migration creates dedupe query and active indexes', async () => {
  const queryMock = jest.fn().mockResolvedValue(undefined);
  const addIndexMock = jest.fn().mockResolvedValue(undefined);
  const queryInterface = {
    sequelize: { query: queryMock },
    addIndex: addIndexMock,
  };

  await migration.up(queryInterface);

  expect(queryMock).toHaveBeenCalledTimes(1);
  expect(queryMock.mock.calls[0][0]).toContain('WITH ranked AS');
  expect(addIndexMock).toHaveBeenCalledTimes(2);
  expect(addIndexMock).toHaveBeenNthCalledWith(
    1,
    'user_availabilities',
    ['user_id', 'date'],
    expect.objectContaining({
      name: 'uq_user_availabilities_user_date_active',
      unique: true,
      where: { deleted_at: null },
    })
  );
  expect(addIndexMock).toHaveBeenNthCalledWith(
    2,
    'user_availabilities',
    ['date'],
    expect.objectContaining({
      name: 'idx_user_availabilities_date_active',
      where: { deleted_at: null },
    })
  );
});

test('user availabilities indexes migration removes indexes on down', async () => {
  const removeIndexMock = jest.fn().mockResolvedValue(undefined);
  const queryInterface = {
    removeIndex: removeIndexMock,
  };

  await migration.down(queryInterface);

  expect(removeIndexMock).toHaveBeenNthCalledWith(
    1,
    'user_availabilities',
    'idx_user_availabilities_date_active'
  );
  expect(removeIndexMock).toHaveBeenNthCalledWith(
    2,
    'user_availabilities',
    'uq_user_availabilities_user_date_active'
  );
});
