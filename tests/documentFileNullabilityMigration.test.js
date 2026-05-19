import { expect, jest, test } from '@jest/globals';

const migration = (
  await import('../src/migrations/20260519120000-repair-document-file-nullability.js')
).default;

test('document file nullability repair migration uses explicit postchecked SQL', async () => {
  const transaction = { id: 'tx-1' };
  const queryMock = jest.fn().mockResolvedValue(undefined);
  const transactionMock = jest.fn(async (callback) => callback(transaction));
  const queryInterface = {
    sequelize: {
      query: queryMock,
      transaction: transactionMock,
    },
  };

  await migration.up(queryInterface);

  expect(transactionMock).toHaveBeenCalledTimes(1);
  expect(queryMock).toHaveBeenCalledTimes(2);
  expect(queryMock).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining(
      'ALTER TABLE public.documents ALTER COLUMN file_id DROP NOT NULL'
    ),
    { transaction }
  );
  expect(queryMock.mock.calls[0][0]).toContain('DROP CONSTRAINT IF EXISTS');
  expect(queryMock.mock.calls[0][0]).toContain(
    'ADD CONSTRAINT documents_file_id_fkey'
  );
  expect(queryMock.mock.calls[0][0]).toContain('ON DELETE CASCADE');
  expect(queryMock.mock.calls[0][0]).toContain('RAISE EXCEPTION');
  expect(queryMock.mock.calls[0][0]).toContain('fk_count <> 1');
  expect(queryMock).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining(
      'uq_referee_closing_documents_active_draft_referee'
    ),
    { transaction }
  );
});
