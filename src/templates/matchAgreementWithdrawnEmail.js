import { buildMatchEmail } from './helpers/matchAgreementEmail.js';

export function renderMatchAgreementWithdrawnEmail(event) {
  const subject = `Заявка отозвана: ${event.team1} — ${event.team2}`;
  const previewText = 'Инициатор отозвал заявку на согласование матча.';
  const intro =
    'Инициатор отозвал заявку на согласование матча. Ожидается новая инициатива.';

  return buildMatchEmail({ subject, previewText, intro, event });
}

export default { renderMatchAgreementWithdrawnEmail };
