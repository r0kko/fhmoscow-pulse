export function renderTrainingRoleChangedEmail(training, role) {
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
  const subject = 'Изменена роль на тренировке';
  let text = `Администратор изменил вашу роль на тренировке ${date}.`;
  if (roleName) text += `\nНовая роль: ${roleName}.`;
  if (address) {
    text += `\nМесто проведения: ${address}`;
    if (yandexUrl) text += ` (${yandexUrl})`;
    text += '.';
  }
  text += '\n\nЕсли вы считаете это ошибкой, обратитесь в службу поддержки.';
  const htmlRole = roleName
    ? `<p style="font-size:16px;margin:0 0 16px;">Новая роль: ${roleName}.</p>`
    : '';
  const htmlAddress = address
    ? `<p style="font-size:16px;margin:0 0 16px;">Место проведения: ${address}${
        yandexUrl ? ` (<a href="${yandexUrl}" target="_blank">Яндекс.Карты</a>)` : ''
      }.</p>`
    : '';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Администратор изменил вашу роль на тренировке ${date} (МСК).
      </p>
      ${htmlRole}
      ${htmlAddress}
      <p style="font-size:12px;color:#777;margin:0;">
        Если вы считаете это ошибкой, обратитесь в службу поддержки.
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderTrainingRoleChangedEmail };
