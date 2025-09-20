import { buildEmail, paragraph, heading } from './email/index.js';
import { buildDigestTable } from './helpers/matchAgreementEmail.js';

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
    'Ниже — сводка по матчам вашей команды. Просим назначить время и площадку при отсутствии предложений, а также принять решение по заявкам, ожидающим ответа более суток.';

  const blocks = [paragraph('Здравствуйте!'), paragraph(intro)];

  if (assignCount) {
    blocks.push(
      heading('Назначить время и площадку (до матча < 7 дней)', { level: 3 })
    );
    const tableBlock = buildDigestTable(
      'Назначить',
      assign.map((row) => ({ ...row, matchId: row.matchId }))
    );
    if (tableBlock) blocks.push(tableBlock);
  }

  if (decideCount) {
    blocks.push(
      heading('Ожидается ваше решение (заявки ждут более суток)', { level: 3 })
    );
    const tableBlock = buildDigestTable(
      'Решить',
      decide.map((row) => ({ ...row, matchId: row.matchId }))
    );
    if (tableBlock) blocks.push(tableBlock);
  }

  if (!assignCount && !decideCount) {
    blocks.push(paragraph('Все текущие матчи согласованы.'));
  }

  blocks.push(
    paragraph(
      `Перейти к списку согласований: <a href="${appUrl}/school-matches" target="_blank">${appUrl}/school-matches</a>.`,
      { html: true }
    )
  );

  return buildEmail({
    subject,
    previewText: 'Сводка по согласованию матчей',
    blocks,
  });
}

export default { renderMatchAgreementDailyDigestEmail };
