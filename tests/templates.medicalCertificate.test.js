import { expect, test } from '@jest/globals';
import { renderMedicalCertificateAddedEmail } from '../src/templates/medicalCertificateAddedEmail.js';

test('renderMedicalCertificateAddedEmail returns subject/text/html', () => {
  const res = renderMedicalCertificateAddedEmail();
  expect(res.subject).toMatch(/медицинское заключение/i);
  expect(res.text).toMatch(/личном кабинете/i);
  expect(res.html).toMatch(/АСОУ ПД Пульс/);
});
