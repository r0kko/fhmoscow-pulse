import { jest, expect, test } from '@jest/globals';

import { Sequelize } from 'sequelize';

// Create isolated Sequelize instance; connection calls are mocked
const sequelize = new Sequelize('postgres://user:pass@localhost:5432/db', {
  logging: false,
});

// Mock query before importing model to avoid real DB calls
sequelize.query = jest.fn().mockResolvedValue([{ nextval: 7 }]);

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: sequelize,
}));

const { default: Document } = await import('../src/models/document.js');

test('generates document number before validation', async () => {
  const doc = Document.build({
    recipient_id: 'u1',
    document_type_id: 't1',
    status_id: 's1',
    file_id: 'f1',
    sign_type_id: 'st1',
    name: 'Test Doc',
    document_date: new Date('2025-04-10'),
  });
  await doc.validate();
  expect(doc.number).toBe('25.04/7');
});
