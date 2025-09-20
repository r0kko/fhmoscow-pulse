import {
  buildEmail,
  paragraph,
  infoGrid,
  button,
  table,
} from '../email/index.js';
import { escapeHtml } from '../../utils/html.js';
import { utcToMoscow } from '../../utils/time.js';

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

function buildMatchRows(event) {
  return [
    { label: 'Матч', value: `${event.team1} — ${event.team2}` },
    event.tournament ? { label: 'Турнир', value: event.tournament } : null,
    event.group ? { label: 'Группа', value: event.group } : null,
    event.tour ? { label: 'Тур', value: event.tour } : null,
    { label: 'Дата и время', value: formatKickoff(event.kickoff) },
    event.ground ? { label: 'Площадка', value: event.ground } : null,
  ].filter(Boolean);
}

function agreementUrl(event) {
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  return `${baseUrl}/school-matches/${event.matchId}/agreements`;
}

export function buildMatchEmail({
  subject,
  previewText,
  intro,
  event,
  additionalBlocks = [],
}) {
  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(intro, { html: true }),
    infoGrid(buildMatchRows(event)),
    ...additionalBlocks,
    button('Открыть карточку согласования', agreementUrl(event)),
  ];

  return buildEmail({ subject, previewText, blocks });
}

export function buildDigestTable(title, rows) {
  if (!rows?.length) return null;
  return table(
    [
      { key: 'match', title: 'Матч' },
      { key: 'time', title: 'Дата и время' },
      { key: 'ground', title: 'Площадка' },
      { key: 'action', title: 'Действие', align: 'right', allowHtml: true },
    ],
    rows.map((row) => {
      const tournamentLine = row.tournament
        ? `<br/><span style="color:#64748B;">${escapeHtml(row.tournament)}</span>`
        : '';
      return {
        match: {
          allowHtml: true,
          html: `${escapeHtml(row.team1)} — ${escapeHtml(row.team2)}${tournamentLine}`,
        },
        time: { text: formatKickoff(row.kickoff) },
        ground: { text: row.ground || '—' },
        action: {
          allowHtml: true,
          html: `<a href="${agreementUrl(row)}" style="display:inline-block;padding:8px 16px;background:#0F62FE;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">Открыть</a>`,
        },
      };
    }),
    { zebra: true }
  );
}

export default buildMatchEmail;
