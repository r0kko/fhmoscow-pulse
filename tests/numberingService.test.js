import { beforeEach, expect, jest, test } from '@jest/globals';
import { Sequelize } from 'sequelize';

const sequelize = new Sequelize('postgres://user:pass@localhost:5432/db', {
  logging: false,
});

sequelize.query = jest.fn().mockResolvedValue([{ last_seq: 7 }]);

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: sequelize,
}));

const { nextDocumentNumber, nextMatchProtocolNumber } =
  await import('../src/services/numberingService.js');

beforeEach(() => {
  sequelize.query.mockClear();
  sequelize.query.mockResolvedValue([{ last_seq: 7 }]);
});

test('nextDocumentNumber formats yearly document number', async () => {
  const value = await nextDocumentNumber(new Date('2026-01-03T10:00:00.000Z'));
  expect(value).toBe('26.01/7');
  expect(sequelize.query).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO number_counters'),
    expect.objectContaining({
      replacements: expect.objectContaining({
        scope: 'DOCUMENT',
        year: 2026,
      }),
    })
  );
});

test('nextMatchProtocolNumber uses dedicated scope and same format', async () => {
  sequelize.query.mockResolvedValue([{ last_seq: 1 }]);
  const value = await nextMatchProtocolNumber(
    new Date('2027-12-30T10:00:00.000Z')
  );
  expect(value).toBe('27.12/1');
  expect(sequelize.query).toHaveBeenCalledWith(
    expect.stringContaining('match_protocol_snapshots'),
    expect.objectContaining({
      replacements: expect.objectContaining({
        scope: 'MATCH_PROTOCOL',
        year: 2027,
      }),
    })
  );
});
