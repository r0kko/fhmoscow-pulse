import { beforeEach, jest, expect, test } from '@jest/globals';

import sequelize from '../src/config/database.js';
import Document from '../src/models/document.js';

beforeEach(() => {
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
