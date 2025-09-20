import { buildEmail, paragraph, infoGrid, button } from '../email/index.js';

function formatTrainingDate(value) {
  if (!value) return null;
  try {
    const formatted = new Date(value)
      .toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      .replace(',', '');
    return `${formatted} (МСК)`;
  } catch {
    return null;
  }
}

function buildLocationRow(training) {
  const ground = training?.Ground || training?.ground || {};
  const address = ground.Address?.result || ground.address?.result;
  if (!address) return null;
  const yandexUrl = ground.yandex_url;
  return {
    label: 'Площадка',
    value: yandexUrl
      ? `${address} (<a href="${yandexUrl}" target="_blank">Яндекс.Карты</a>)`
      : address,
    allowHtml: Boolean(yandexUrl),
  };
}

function defaultButtonUrl(training) {
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  return training?.id
    ? `${baseUrl}/trainings/${training.id}`
    : `${baseUrl}/trainings`;
}

export function buildTrainingEmail({
  subject,
  previewText,
  intro,
  training,
  extraInfoRows = [],
  extraBlocks = [],
  buttonLabel = 'Открыть тренировку',
  buttonUrl,
}) {
  const trainingDate = formatTrainingDate(training?.start_at);
  const locationRow = buildLocationRow(training);
  const rows = [
    trainingDate ? { label: 'Дата и время', value: trainingDate } : null,
    locationRow,
    ...extraInfoRows,
  ].filter(Boolean);

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(intro, { html: true }),
    rows.length ? infoGrid(rows) : null,
    ...extraBlocks,
    button(buttonLabel, buttonUrl || defaultButtonUrl(training)),
  ].filter(Boolean);

  return buildEmail({ subject, previewText, blocks });
}

export default buildTrainingEmail;
