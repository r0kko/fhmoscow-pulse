import { escapeHtml } from '../utils/html.js';
import { utcToMoscow } from '../utils/time.js';

function fmt(date) {
  const d = utcToMoscow(date) || new Date(date);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy}, ${hh}:${mi} МСК`;
}

export function renderMatchAgreementDailyDigestEmail(digest) {
  const appUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const assign = Array.isArray(digest.assign) ? digest.assign : [];
  const decide = Array.isArray(digest.decide) ? digest.decide : [];
  const assignCount = assign.length;
  const decideCount = decide.length;

  let subject = 'Согласование матчей';
  if (assignCount || decideCount) {
    const parts = [];
    if (assignCount) parts.push(`${assignCount} назначить`);
    if (decideCount) parts.push(`${decideCount} решить`);
    subject = `Матчи на согласование: ${parts.join(', ')}`;
  }

  const intro =
    'Здравствуйте! Ниже — сводка по матчам вашей команды. Просим назначить время и площадку при отсутствии предложений, а также принять решение по заявкам, ожидающим ответа более суток.';

  const renderRow = (e) => {
    const ground = e.ground ? escapeHtml(e.ground) : '—';
    const when = e.kickoff ? escapeHtml(fmt(e.kickoff)) : '—';
    const dl = typeof e.daysLeft === 'number' ? `${e.daysLeft} дн.` : '—';
    const title = `${escapeHtml(e.team1)} — ${escapeHtml(e.team2)}`;
    const tournament = e.tournament ? `, ${escapeHtml(e.tournament)}` : '';
    const group = e.group ? `, ${escapeHtml(e.group)}` : '';
    const tour = e.tour ? `, ${escapeHtml(e.tour)}` : '';
    return `
      <tr>
        <td style="padding:8px 6px;">${title}<span style="color:#6c757d">${tournament}${group}${tour}</span></td>
        <td style="padding:8px 6px; white-space:nowrap;">${when}</td>
        <td style="padding:8px 6px;">${ground}</td>
        <td style="padding:8px 6px; white-space:nowrap;">${escapeHtml(dl)}</td>
        <td style="padding:8px 6px; text-align:right;">
          <a href="${appUrl}/school-matches/${e.matchId}/agreements" target="_blank" style="display:inline-block;background:#0F62FE;color:#fff;text-decoration:none;padding:6px 10px;border-radius:6px;font-weight:600;">Открыть</a>
        </td>
      </tr>`;
  };

  const section = (title, rows) => {
    if (!rows.length) return '';
    const trs = rows.map((e) => renderRow(e)).join('\n');
    return `
      <h3 style="font-size:16px;margin:24px 0 8px;">${escapeHtml(title)}</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
        <thead>
          <tr style="background:#f8f9fa;">
            <th style="text-align:left;padding:8px 6px;">Матч</th>
            <th style="text-align:left;padding:8px 6px;">Дата и время</th>
            <th style="text-align:left;padding:8px 6px;">Площадка</th>
            <th style="text-align:left;padding:8px 6px;">До матча</th>
            <th style="text-align:right;padding:8px 6px;">Действие</th>
          </tr>
        </thead>
        <tbody>${trs}</tbody>
      </table>`;
  };

  const textList = (title, rows) => {
    if (!rows.length) return '';
    const lines = rows
      .map((e) => {
        const when = e.kickoff ? fmt(e.kickoff) : '—';
        const dl = typeof e.daysLeft === 'number' ? `${e.daysLeft} дн.` : '—';
        return `• ${e.team1} — ${e.team2} (${when}, ${e.ground || '—'}, до матча: ${dl}) → ${appUrl}/school-matches/${e.matchId}/agreements`;
      })
      .join('\n');
    return `\n${title}:\n${lines}\n`;
  };

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">${escapeHtml(intro)}</p>
      ${section('Назначить время и площадку (отсутствуют предложения, до матча < 7 дней)', assign)}
      ${section('Ожидается ваше решение (заявки ждут более суток)', decide)}
    </div>`;

  const text =
    `${intro}\n` +
    textList('Назначить время и площадку (до матча < 7 дней)', assign) +
    textList('Ожидается ваше решение (заявки ждут более суток)', decide);

  return { subject, text, html };
}

export default { renderMatchAgreementDailyDigestEmail };
