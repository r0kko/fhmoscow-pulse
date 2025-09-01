import { expect, test } from '@jest/globals';

import { renderMatchAgreementProposedEmail } from '../src/templates/matchAgreementProposedEmail.js';
import { renderMatchAgreementCounterProposedEmail } from '../src/templates/matchAgreementCounterProposedEmail.js';
import { renderMatchAgreementApprovedEmail } from '../src/templates/matchAgreementApprovedEmail.js';
import { renderMatchAgreementDeclinedEmail } from '../src/templates/matchAgreementDeclinedEmail.js';
import { renderMatchAgreementWithdrawnEmail } from '../src/templates/matchAgreementWithdrawnEmail.js';
import { renderMatchAgreementReminderEmail } from '../src/templates/matchAgreementReminderEmail.js';

const base = {
  matchId: 'm1',
  team1: 'Home',
  team2: 'Away',
  tournament: 'Cup',
  group: 'A',
  tour: '1',
  ground: 'Stadium',
  kickoff: '2025-01-01T10:00:00Z',
};

test('proposed email renders', () => {
  const { subject, text, html } = renderMatchAgreementProposedEmail({ ...base, by: 'home' });
  expect(subject).toMatch(/Новая заявка/);
  expect(text).toContain('Матч: Home — Away');
  expect(html).toContain('Открыть карточку согласования');
});

test('counter-proposed email renders', () => {
  const { subject, text, html } = renderMatchAgreementCounterProposedEmail(base);
  expect(subject).toMatch(/Контр-заявка/);
  expect(text).toContain('Стадион');
  expect(html).toContain('контр-заявка');
});

test('approved email renders', () => {
  const { subject, text, html } = renderMatchAgreementApprovedEmail(base);
  expect(subject).toMatch(/Матч согласован/);
  expect(text).toContain('Место и время матча согласованы');
  expect(html).toContain('Матч:');
});

test('declined email renders', () => {
  const { subject, text, html } = renderMatchAgreementDeclinedEmail(base);
  expect(subject).toMatch(/Заявка отклонена/);
  expect(text).toContain('Заявка на согласование матча была отклонена');
  expect(html).toContain('отклонена');
});

test('withdrawn email renders', () => {
  const { subject, text, html } = renderMatchAgreementWithdrawnEmail(base);
  expect(subject).toMatch(/Заявка отозвана/);
  expect(text).toContain('заявка на согласование матча была отозвана');
  expect(html).toContain('отозвана');
});

test('reminder email variants render', () => {
  const a = renderMatchAgreementReminderEmail({ ...base, status: 'no_proposal' });
  const b = renderMatchAgreementReminderEmail({ ...base, status: 'pending_you' });
  const c = renderMatchAgreementReminderEmail({ ...base, status: 'other' });
  expect(a.subject).toMatch(/Необходимо назначить/);
  expect(b.subject).toMatch(/Ожидается ваше решение/);
  expect(c.subject).toMatch(/Напоминание/);
});

