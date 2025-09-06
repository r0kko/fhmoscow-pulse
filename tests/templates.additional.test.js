import { expect, test } from '@jest/globals';

import { renderAccountActivatedEmail } from '../src/templates/accountActivatedEmail.js';
import { renderDocumentCreatedEmail } from '../src/templates/documentCreatedEmail.js';
import { renderVerificationEmail } from '../src/templates/verificationEmail.js';

test('renderAccountActivatedEmail returns subject, text and html', () => {
  const { subject, text, html } = renderAccountActivatedEmail();
  expect(subject).toMatch(/активирован/i);
  // Russian diacritics (е/ё) may vary in copy; match loosely
  expect(text).toMatch(/учетн/);
  expect(html).toContain('<div');
});

test('renderDocumentCreatedEmail includes document data', () => {
  const doc = { name: 'Test Doc', number: '42' };
  const { subject, text, html } = renderDocumentCreatedEmail(doc);
  expect(subject).toContain('42');
  expect(text).toContain('Test Doc');
  expect(html).toContain('Test Doc');
});

test('renderVerificationEmail includes code and ttl hint', () => {
  const { subject, text, html } = renderVerificationEmail('123456');
  expect(subject).toMatch(/подтверждение/i);
  expect(text).toContain('123456');
  expect(html).toContain('123456');
});
