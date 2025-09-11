import { expect, test } from '@jest/globals';

import { renderMedicalExamRegistrationCancelledEmail } from '../src/templates/medicalExamRegistrationCancelledEmail.js';
import { renderMedicalExamRegistrationCompletedEmail } from '../src/templates/medicalExamRegistrationCompletedEmail.js';
import { renderMedicalExamRegistrationSelfCancelledEmail } from '../src/templates/medicalExamRegistrationSelfCancelledEmail.js';

const exam = { start_at: '2025-05-01T12:00:00Z' };

test('medical exam cancelled/completed emails render text and html', () => {
  const c = renderMedicalExamRegistrationCancelledEmail(exam);
  const d = renderMedicalExamRegistrationCompletedEmail(exam);
  expect(c.subject).toMatch(/отмен/);
  expect(c.text).toMatch(/заявк/);
  expect(d.subject).toMatch(/заверш/);
  expect(d.text).toMatch(/осмотр/);
});

test('medical exam self-cancelled email renders', () => {
  const s = renderMedicalExamRegistrationSelfCancelledEmail(exam);
  expect(s.subject).toMatch(/отмен/);
  expect(s.text).toMatch(/Вы отменили/);
});
