import { buildMatchEmail } from './helpers/matchAgreementEmail.js';

function proposerLabel(event) {
  return event?.by === 'home' ? 'домашней командой' : 'гостевой командой';
}

export function renderMatchAgreementProposedEmail(event) {
  const subject = `Новая заявка: ${event.team1} — ${event.team2}`;
  const previewText = 'Поступила заявка на согласование матча.';
  const intro = `Поступила новая заявка на согласование матча (<strong>${proposerLabel(event)}</strong>).`;

  return buildMatchEmail({ subject, previewText, intro, event });
}

export default { renderMatchAgreementProposedEmail };
