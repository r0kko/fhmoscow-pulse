import { beforeEach, jest, expect, test } from '@jest/globals';

let sequelize;
let Document;

beforeEach(async () => {
  await jest.isolateModulesAsync(async () => {
    sequelize = (await import('../src/config/database.js')).default;
    Document = (await import('../src/models/document.js')).default;
  });
  jest.spyOn(sequelize, 'query').mockResolvedValue([{ nextval: 7 }]);
});

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
