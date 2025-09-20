import { buildMatchEmail } from './helpers/matchAgreementEmail.js';

export function renderMatchAgreementApprovedEmail(event) {
  const subject = `Матч согласован: ${event.team1} — ${event.team2}`;
  const previewText = 'Время и место матча согласованы.';
  const intro = '<strong>Место и время матча согласованы.</strong>';

  return buildMatchEmail({ subject, previewText, intro, event });
}

export default { renderMatchAgreementApprovedEmail };
