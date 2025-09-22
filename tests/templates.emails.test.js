import { expect, test } from '@jest/globals';

import { renderNormativeResultAddedEmail } from '../src/templates/normativeResultAddedEmail.js';
import { renderNormativeResultRemovedEmail } from '../src/templates/normativeResultRemovedEmail.js';
import { renderNormativeResultUpdatedEmail } from '../src/templates/normativeResultUpdatedEmail.js';
import { renderMatchAgreementDailyDigestEmail } from '../src/templates/matchAgreementDailyDigestEmail.js';
import { renderMedicalExamRegistrationApprovedEmail } from '../src/templates/medicalExamRegistrationApprovedEmail.js';
import { renderMedicalExamRegistrationCreatedEmail } from '../src/templates/medicalExamRegistrationCreatedEmail.js';

test('normative result emails cover branches', () => {
  const type = { name: 'Купер', MeasurementUnit: { alias: 'MIN_SEC' } };
  const training = {
    start_at: '2025-02-01T10:00:00Z',
    Ground: { Address: { result: 'Стадион' }, yandex_url: 'http://maps' },
  };
  const base = {
    value: 125,
    NormativeType: type,
    Training: training,
    retake: true,
    NormativeZone: { name: 'GREEN' },
  };
  const a = renderNormativeResultAddedEmail(base);
  expect(a.subject).toContain('Добавлен');
  const r = renderNormativeResultRemovedEmail({
    ...base,
    online: true,
    retake: false,
  });
  expect(r.subject).toContain('удален');
  const u = renderNormativeResultUpdatedEmail(base);
  expect(u.subject).toContain('Изменен');
});

test('match agreement daily digest email renders assign/decide sections', () => {
  const now = '2025-03-01T10:00:00Z';
  const e = {
    matchId: 'm1',
    team1: 'A',
    team2: 'B',
    kickoff: now,
    ground: 'Arena',
    daysLeft: 3,
    tournament: 'Cup',
    group: 'A',
    tour: '1',
  };
  const { subject, html, text } = renderMatchAgreementDailyDigestEmail({
    totals: { assign: 1, decide: 1 },
    teams: [{ teamId: 't1', teamName: 'Команда 1', assign: [e], decide: [e] }],
  });
  expect(subject).toContain('Матчи на согласование');
  expect(html).toContain('Назначить время');
  expect(text).toContain('Ожидается ваше решение');
});

test('medical exam emails render with and without address/admin', () => {
  const exam = {
    start_at: '2025-04-01T09:00:00Z',
    MedicalCenter: { Address: { result: 'Клиника' } },
  };
  const app = renderMedicalExamRegistrationApprovedEmail(exam);
  expect(app.subject).toContain('подтверждена');
  const created1 = renderMedicalExamRegistrationCreatedEmail(exam, true);
  const created2 = renderMedicalExamRegistrationCreatedEmail(
    { start_at: exam.start_at, center: {} },
    false
  );
  expect(created1.subject).toContain('создана');
  expect(created2.text).toContain('Вы записались');
});
