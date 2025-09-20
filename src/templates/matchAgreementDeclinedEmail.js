import { buildMatchEmail } from './helpers/matchAgreementEmail.js';

export function renderMatchAgreementDeclinedEmail(event) {
  const subject = `Заявка отклонена: ${event.team1} — ${event.team2}`;
  const previewText = 'Заявка на согласование матча отклонена.';
  const intro =
    '<strong>Заявка на согласование отклонена.</strong> Посмотрите комментарии и предложите новые условия.';

  return buildMatchEmail({ subject, previewText, intro, event });
}

export default { renderMatchAgreementDeclinedEmail };
