import { expect, jest, test } from '@jest/globals';

const migration = (
  await import('../src/migrations/20260519123000-normalize-closing-document-schema-job-errors.js')
).default;

test('closing document schema job error migration removes raw database errors', async () => {
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
  expect(queryMock).toHaveBeenCalledWith(
    expect.stringContaining('closing_document_schema_outdated'),
    { transaction }
  );
  expect(queryMock.mock.calls[0][0]).toContain('async_job_items');
  expect(queryMock.mock.calls[0][0]).toContain('async_job_events');
  expect(queryMock.mock.calls[0][0]).toContain(
    'null value in column "file_id"'
  );
});
