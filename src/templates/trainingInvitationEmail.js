export function renderTrainingInvitationEmail(training) {
  const typeName = training.TrainingType?.name || 'мероприятие';
  const subject = `Приглашение на ${typeName}`;
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
  const isOnline = training.TrainingType?.online;
  const ground = training.Ground || training.ground || {};
  const address = ground.Address?.result || ground.address?.result;
  const yandexUrl = ground.yandex_url;
  const url = training.url;

  let text = `Вы приглашены на ${typeName.toLowerCase()} которое состоится ${date}`;
  if (isOnline && url) {
    text += `. Онлайн по ссылке: ${url}.`;
  } else if (address) {
    text += `. Место проведения: ${address}`;
    if (yandexUrl) text += ` (${yandexUrl})`;
    text += '.';
  } else {
    text += '.';
  }
  text +=
    '\nПожалуйста, подтвердите свое присутствие в разделе "Повышение квалификации", нажав кнопку "Записаться". Обращаем Ваше внимание, что количество мест ограничено.';

  const htmlLocation =
    isOnline && url
      ? `<p style="font-size:16px;margin:0 0 16px;">Онлайн по ссылке: <a href="${url}" target="_blank">${url}</a>.</p>`
      : address
        ? `<p style="font-size:16px;margin:0 0 16px;">Место проведения: ${address}${
            yandexUrl
              ? ` (<a href="${yandexUrl}" target="_blank">Яндекс.Карты</a>)`
              : ''
          }.</p>`
        : '';

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">Вы приглашены на ${typeName.toLowerCase()} ${date} (МСК).</p>
      ${htmlLocation}
      <p style="font-size:16px;margin:0 0 16px;">Пожалуйста, подтвердите свое присутствие в разделе «Повышение квалификации», нажав кнопку «Записаться».</p>
      <p style="font-size:16px;margin:0;">Обращаем Ваше внимание, что количество мест ограничено.</p>
    </div>`;
  return { subject, text, html };
}

export default { renderTrainingInvitationEmail };
