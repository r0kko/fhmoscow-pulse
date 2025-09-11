import { expect, test } from '@jest/globals';

import { renderVerificationEmail } from '../src/templates/verificationEmail.js';
import { renderSignTypeSelectionEmail } from '../src/templates/signTypeSelectionEmail.js';

test('renderVerificationEmail includes code in text and html', () => {
  const res = renderVerificationEmail('123456');
  expect(res.subject).toMatch(/подтверждение/i);
  expect(res.text).toContain('123456');
  expect(res.html).toContain('123456');
});

test('renderSignTypeSelectionEmail includes code in text and html', () => {
  const res = renderSignTypeSelectionEmail('ABCDEF');
  expect(res.subject).toMatch(/подписи/i);
  expect(res.text).toContain('ABCDEF');
  expect(res.html).toContain('ABCDEF');
});
