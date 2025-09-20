import { buildEmail, paragraph, infoGrid, button } from '../email/index.js';
import { formatMinutesSeconds } from '../../utils/time.js';

function formatResultValue(result) {
  const unitAlias = result?.NormativeType?.MeasurementUnit?.alias;
  if (unitAlias === 'MIN_SEC') {
    return formatMinutesSeconds(result?.value);
  }
  return result?.display_value ?? result?.value ?? '';
}

function formatDate(value) {
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

function normalizeLink(address, link) {
  if (!address) return null;
  if (link) {
    return `${address} (<a href="${link}" target="_blank">Яндекс.Карты</a>)`;
  }
  return address;
}

export function buildNormativeEmail(result, { subject, intro, previewText }) {
  const typeName =
    result?.NormativeType?.name || result?.type?.name || 'Норматив';
  const groupName =
    result?.group?.name ||
    result?.NormativeType?.NormativeGroupTypes?.[0]?.NormativeGroup?.name ||
    '';
  const zoneName = result?.zone?.name || result?.NormativeZone?.name || '';
  const value = formatResultValue(result);
  const training = result?.Training || result?.training || {};
  const trainingDate = formatDate(training.start_at);
  const ground = training.Ground || training.ground || {};
  const address = ground.Address?.result || ground.address?.result;
  const yandexUrl = ground.yandex_url;
  const baseUrl = process.env.BASE_URL || 'https://lk.fhmoscow.com';
  const trainingUrl = training.id
    ? `${baseUrl}/trainings/${training.id}`
    : `${baseUrl}/trainings`;

  const normativeRows = [
    {
      label: 'Норматив',
      value: groupName ? `${typeName} (${groupName})` : typeName,
    },
    { label: 'Результат', value },
    zoneName ? { label: 'Зона', value: zoneName } : null,
    result?.retake
      ? { label: 'Статус', value: 'Перезачет' }
      : result?.online
        ? { label: 'Формат', value: 'Сдан онлайн' }
        : null,
  ].filter(Boolean);

  const trainingRows = [
    trainingDate ? { label: 'Тренировка', value: trainingDate } : null,
    address
      ? {
          label: 'Площадка',
          value: normalizeLink(address, yandexUrl),
          allowHtml: Boolean(yandexUrl),
        }
      : null,
  ].filter(Boolean);

  const blocks = [
    paragraph('Здравствуйте!'),
    paragraph(intro, { html: true }),
    normativeRows.length ? infoGrid(normativeRows) : null,
    trainingRows.length ? infoGrid(trainingRows) : null,
    button('Открыть тренировку', trainingUrl),
  ].filter(Boolean);

  const defaultPreview = `${typeName}${groupName ? ` (${groupName})` : ''}: ${value}`;

  return buildEmail({
    subject,
    previewText: previewText || defaultPreview,
    blocks,
  });
}

export default buildNormativeEmail;
