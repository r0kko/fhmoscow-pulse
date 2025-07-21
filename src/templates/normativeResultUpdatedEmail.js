export function renderNormativeResultUpdatedEmail(result) {
  const typeName = result.NormativeType?.name || result.type?.name || '';
  const groupName =
    result.group?.name ||
    result.NormativeType?.NormativeGroupTypes?.[0]?.NormativeGroup?.name ||
    '';
  const zoneName = result.zone?.name || result.NormativeZone?.name || '';
  const value = result.value;
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
  const subject = 'Изменен результат норматива';
  let text = `Результат по нормативу ${typeName}`;
  if (groupName) text += ` (${groupName})`;
  text += ' изменен.';
  if (date) text += `\nТренировка: ${date}.`;
  if (address) {
    text += `\nСтадион: ${address}`;
    if (yandexUrl) text += ` (${yandexUrl})`;
    text += '.';
  }
  text += `\nЗначение: ${value}.`;
  if (zoneName) text += `\nЗона: ${zoneName}.`;
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
  const htmlZone = zoneName
    ? `<p style="font-size:16px;margin:0 0 16px;">Зона: ${zoneName}.</p>`
    : '';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Результат по нормативу ${typeName}${groupName ? ` (${groupName})` : ''} изменен.
      </p>
      ${htmlDate}
      ${htmlAddress}
      <p style="font-size:16px;margin:0 0 16px;">Значение: ${value}.</p>
      ${htmlZone}
    </div>`;
  return { subject, text, html };
}

export default { renderNormativeResultUpdatedEmail };
