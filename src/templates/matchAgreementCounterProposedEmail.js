import { buildMatchEmail } from './helpers/matchAgreementEmail.js';

export function renderMatchAgreementCounterProposedEmail(event) {
  const subject = `Контр-заявка: ${event.team1} — ${event.team2}`;
  const previewText = 'Получена контр-заявка по матчу.';
  const intro = 'Получена <strong>контр-заявка</strong> на согласование матча.';

  return buildMatchEmail({ subject, previewText, intro, event });
}

export default { renderMatchAgreementCounterProposedEmail };
