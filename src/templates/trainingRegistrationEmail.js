export function renderTrainingRegistrationEmail(training, role) {
  const date = new Date(training.start_at)
    .toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', '');
  const stadium = training.CampStadium || training.stadium || {};
  const address = stadium.Address?.result || stadium.address?.result;
  const yandexUrl = stadium.yandex_url;
  const roleName = role?.name || role?.alias;
  const subject = 'Запись на тренировку подтверждена';

  let text = `Вы успешно записались на тренировку ${date}.`;
  if (roleName) text += `\nРоль: ${roleName}.`;
  if (address) {
    text += `\nМесто проведения: ${address}`;
    if (yandexUrl) text += ` (${yandexUrl})`;
    text += '.';
  }
  text +=
    '\n\nЕсли вы не записывались на тренировку, сообщите об этом администратору.';

  const htmlRole = roleName
    ? `<p style="font-size:16px;margin:0 0 16px;">Ваша роль: ${roleName}.</p>`
    : '';
  const htmlAddress = address
    ? `<p style="font-size:16px;margin:0 0 16px;">Место проведения: ${address}${
        yandexUrl
          ? ` (<a href="${yandexUrl}" target="_blank">Яндекс.Карты</a>)`
          : ''
      }.</p>`
    : '';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Вы успешно записались на тренировку ${date} (МСК).
      </p>
      ${htmlRole}
      ${htmlAddress}
      <p style="font-size:12px;color:#777;margin:0;">
        Если вы не записывались на тренировку, сообщите об этом администратору.
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderTrainingRegistrationEmail };
