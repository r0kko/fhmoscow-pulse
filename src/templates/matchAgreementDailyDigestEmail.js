import { buildEmail, paragraph, heading } from './email/index.js';
import { buildDigestTable } from './helpers/matchAgreementEmail.js';

export function renderMatchAgreementDailyDigestEmail(digest = {}) {
  const appUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const teams = Array.isArray(digest.teams) ? digest.teams : [];
  const totals = digest.totals || {};
  const assignTotalFromTotals = Number.isFinite(totals.assign)
    ? totals.assign
    : null;
  const decideTotalFromTotals = Number.isFinite(totals.decide)
    ? totals.decide
    : null;
  const computedTotals = teams.reduce(
    (acc, team) => {
      const assignCount = Array.isArray(team.assign) ? team.assign.length : 0;
      const decideCount = Array.isArray(team.decide) ? team.decide.length : 0;
      return {
        assign: acc.assign + assignCount,
        decide: acc.decide + decideCount,
      };
    },
    { assign: 0, decide: 0 }
  );

  const assignTotal =
    assignTotalFromTotals !== null
      ? assignTotalFromTotals
      : computedTotals.assign;
  const decideTotal =
    decideTotalFromTotals !== null
      ? decideTotalFromTotals
      : computedTotals.decide;

  let subject = 'Согласование матчей';
  if (assignTotal || decideTotal) {
    const parts = [];
    if (assignTotal) parts.push(`${assignTotal} назначить`);
    if (decideTotal) parts.push(`${decideTotal} решить`);
    subject = `Матчи на согласование: ${parts.join(', ')}`;
  }

  const intro =
    'Ниже — сводка по матчам ваших команд. Просим назначить время и площадку там, где ещё нет предложения, и принять решение по заявкам, которые ожидают ответа более суток.';

  const blocks = [paragraph('Здравствуйте!'), paragraph(intro)];

  if (assignTotal || decideTotal) {
    const summaryParts = [];
    if (assignTotal) summaryParts.push(`${assignTotal} назначить`);
    if (decideTotal) summaryParts.push(`${decideTotal} решить`);
    if (summaryParts.length)
      blocks.push(paragraph(`Всего действий: ${summaryParts.join(', ')}.`));
  }

  if (!teams.length) {
    blocks.push(paragraph('Все текущие матчи согласованы.'));
  } else {
    const teamHeadingLevel = teams.length > 1 ? 2 : 3;
    const taskHeadingLevel = Math.min(teamHeadingLevel + 1, 6);
    for (const team of teams) {
      const teamName = team.teamName || 'Команда';
      const assignRows = Array.isArray(team.assign) ? team.assign : [];
      const decideRows = Array.isArray(team.decide) ? team.decide : [];
      blocks.push(heading(teamName, { level: teamHeadingLevel }));

      if (assignRows.length) {
        blocks.push(
          heading('Назначить время и площадку (до матча < 7 дней)', {
            level: taskHeadingLevel,
          })
        );
        const tableBlock = buildDigestTable(
          'Назначить',
          assignRows.map((row) => ({ ...row, matchId: row.matchId }))
        );
        if (tableBlock) blocks.push(tableBlock);
      }

      if (decideRows.length) {
        blocks.push(
          heading('Ожидается ваше решение (заявки ждут более суток)', {
            level: taskHeadingLevel,
          })
        );
        const tableBlock = buildDigestTable(
          'Решить',
          decideRows.map((row) => ({ ...row, matchId: row.matchId }))
        );
        if (tableBlock) blocks.push(tableBlock);
      }

      if (!assignRows.length && !decideRows.length)
        blocks.push(paragraph('По команде все текущие матчи согласованы.'));
    }
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
