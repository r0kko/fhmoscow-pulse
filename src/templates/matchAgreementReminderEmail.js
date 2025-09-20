import { utcToMoscow } from '../utils/time.js';

import { buildEmail, paragraph, infoGrid, button } from './email/index.js';

function formatKickoff(date) {
  if (!date) return '—';
  const d = utcToMoscow(date) || new Date(date);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy}, ${hh}:${mi} МСК`;
}

function resolveReminder(event) {
  if (event?.status === 'no_proposal') {
    return {
      subject: `Необходимо назначить место и время: ${event.team1} — ${event.team2}`,
      lead: 'По данному матчу отсутствует заявка на согласование места и времени. Просим направить предложение.',
    };
  }
  if (event?.status === 'pending_you') {
    return {
      subject: `Ожидается ваше решение: ${event.team1} — ${event.team2}`,
      lead: 'Есть активная заявка на согласование. Необходимо принять решение.',
    };
  }
  return {
    subject: `Напоминание по согласованию матча: ${event.team1} — ${event.team2}`,
    lead: 'Просим проверить статус согласования матча.',
  };
}

export function renderMatchAgreementReminderEmail(event) {
  const { subject, lead } = resolveReminder(event);
  const previewText = 'Напоминание о согласовании матча.';
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const agreementUrl = `${baseUrl}/school-matches/${event.matchId}/agreements`;

  const rows = [
    { label: 'Матч', value: `${event.team1} — ${event.team2}` },
    event.tournament ? { label: 'Турнир', value: event.tournament } : null,
    event.group ? { label: 'Группа', value: event.group } : null,
    event.tour ? { label: 'Тур', value: event.tour } : null,
    { label: 'Дата и время', value: formatKickoff(event.kickoff) },
    event.ground ? { label: 'Площадка', value: event.ground } : null,
    typeof event.daysLeft === 'number'
      ? { label: 'До матча', value: `${event.daysLeft} дн.` }
      : null,
  ].filter(Boolean);

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(lead),
    infoGrid(rows),
    button('Перейти к согласованию', agreementUrl),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export default { renderMatchAgreementReminderEmail };
