import { expect, test } from '@jest/globals';

import { renderDocumentCreatedEmail } from '../src/templates/documentCreatedEmail.js';
import { renderDocumentRejectedEmail } from '../src/templates/documentRejectedEmail.js';
import { renderDocumentSignedEmail } from '../src/templates/documentSignedEmail.js';
import { renderAccountActivatedEmail } from '../src/templates/accountActivatedEmail.js';

test('renderDocumentCreatedEmail returns subject/text/html with document meta', () => {
  const doc = { name: 'Соглашение', number: 'A-123' };
  const res = renderDocumentCreatedEmail(doc);
  expect(res.subject).toContain('A-123');
  expect(res.text).toContain('Соглашение');
  expect(res.html).toContain('<strong>Соглашение</strong>');
});

test('renderDocumentRejectedEmail returns expected payload', () => {
  const doc = { name: 'Контракт', number: 'B-7' };
  const res = renderDocumentRejectedEmail(doc);
  expect(res.subject).toContain('B-7');
  expect(res.text).toContain('Контракт');
  expect(res.html).toContain('отклонен');
});

test('renderDocumentSignedEmail returns expected payload', () => {
  const doc = { name: 'Договор', number: 'C-9' };
  const res = renderDocumentSignedEmail(doc);
  expect(res.subject).toContain('C-9');
  expect(res.text).toContain('подписан');
  expect(res.html).toContain('<strong>Договор</strong>');
});

test('renderAccountActivatedEmail returns localized subject and HTML', () => {
  const res = renderAccountActivatedEmail();
  expect(res.subject).toMatch(/активирована/i);
  expect(res.text).toMatch(/учетн.+ запись/i);
  expect(res.html).toContain('АСОУ ПД Пульс');
});
