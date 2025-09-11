import { expect, test } from '@jest/globals';
import { renderDocumentSignCodeEmail } from '../src/templates/documentSignCodeEmail.js';

test('renderDocumentSignCodeEmail returns subject/text/html', () => {
  const res = renderDocumentSignCodeEmail(
    { name: 'Договор', number: 'X-7' },
    '999999'
  );
  expect(res.subject).toContain('X-7');
  expect(res.text).toContain('999999');
  expect(res.html).toContain('Договор');
});
