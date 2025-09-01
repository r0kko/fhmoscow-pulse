import { escapeHtml } from '../utils/html.js';
import { utcToMoscow } from '../utils/time.js';

function formatMsk(date) {
  const d = utcToMoscow(date) || new Date(date);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy}, ${hh}:${mi} МСК`;
}

export function renderMatchAgreementCounterProposedEmail(event) {
  const appUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const subject = `Контр-заявка на согласование матча: ${event.team1} — ${event.team2}`;

  const when = formatMsk(event.kickoff);
  const ground = event.ground ? event.ground : '—';
  const greet = 'Здравствуйте!';

  const text =
    `${greet}\n\n` +
    'Получена контр-заявка на согласование матча.\n' +
    `Матч: ${event.team1} — ${event.team2}\n` +
    (event.tournament ? `Турнир: ${event.tournament}\n` : '') +
    (event.group ? `Группа: ${event.group}\n` : '') +
    (event.tour ? `Тур: ${event.tour}\n` : '') +
    `Дата и время: ${when}\n` +
    `Стадион: ${ground}\n\n` +
    `Перейдите в систему для просмотра и принятия решения: ${appUrl}/school-matches/${event.matchId}/agreements`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">${greet}</p>
      <p style="font-size:16px;margin:0 0 16px;">Получена <strong>контр-заявка</strong> на согласование матча.</p>
      <div style="font-size:16px;margin:0 0 12px;">
        <div><strong>Матч:</strong> ${escapeHtml(
          event.team1
        )} — ${escapeHtml(event.team2)}</div>
        ${event.tournament ? `<div><strong>Турнир:</strong> ${escapeHtml(event.tournament)}</div>` : ''}
        ${event.group ? `<div><strong>Группа:</strong> ${escapeHtml(event.group)}</div>` : ''}
        ${event.tour ? `<div><strong>Тур:</strong> ${escapeHtml(event.tour)}</div>` : ''}
        <div><strong>Дата и время:</strong> ${escapeHtml(when)}</div>
        <div><strong>Стадион:</strong> ${escapeHtml(ground)}</div>
      </div>
      <p style="margin:16px 0;">
        <a href="${appUrl}/school-matches/${event.matchId}/agreements" target="_blank" style="display:inline-block;background:#0F62FE;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600;">Открыть карточку согласования</a>
      </p>
    </div>`;

  return { subject, text, html };
}

export default { renderMatchAgreementCounterProposedEmail };
