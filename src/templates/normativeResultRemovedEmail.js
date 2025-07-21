export function renderNormativeResultRemovedEmail(result) {
  const typeName = result.NormativeType?.name || result.type?.name || '';
  const groupName =
    result.group?.name ||
    result.NormativeType?.NormativeGroupTypes?.[0]?.NormativeGroup?.name ||
    '';
  const training = result.Training || result.training || {};
  const date = training.start_at
    ? new Date(training.start_at)
        .toLocaleString('ru-RU', {
          timeZone: 'Europe/Moscow',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
        .replace(',', '')
    : null;
  const stadium = training.CampStadium || training.stadium || {};
  const address = stadium.Address?.result || stadium.address?.result;
  const yandexUrl = stadium.yandex_url;
  const subject = 'Результат норматива удален';
  let text = `Результат по нормативу ${typeName}`;
  if (groupName) text += ` (${groupName})`;
  text += ' удален.';
  if (date) text += `\nТренировка: ${date}.`;
  if (address) {
    text += `\nСтадион: ${address}`;
    if (yandexUrl) text += ` (${yandexUrl})`;
    text += '.';
  }
  const htmlAddress = address
    ? `<p style="font-size:16px;margin:0 0 16px;">Стадион: ${address}${
        yandexUrl
          ? ` (<a href="${yandexUrl}" target="_blank">Яндекс.Карты</a>)`
          : ''
      }.</p>`
    : '';
  const htmlDate = date
    ? `<p style="font-size:16px;margin:0 0 16px;">Тренировка: ${date} (МСК).</p>`
    : '';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Результат по нормативу ${typeName}${groupName ? ` (${groupName})` : ''} удален.
      </p>
      ${htmlDate}
      ${htmlAddress}
    </div>`;
  return { subject, text, html };
}

export default { renderNormativeResultRemovedEmail };
