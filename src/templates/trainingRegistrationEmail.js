export function renderTrainingRegistrationEmail(
  training,
  role,
  byAdmin = false
) {
  const isCamp = training.TrainingType?.for_camp;
  const subject = `Запись на ${isCamp ? 'тренировку' : 'мероприятие'} подтверждена`;
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
  const ground = training.Ground || training.ground || {};
  const address = ground.Address?.result || ground.address?.result;
  const yandexUrl = ground.yandex_url;
  const roleName = role?.name || role?.alias;
  const typeAcc = isCamp ? 'тренировку' : 'мероприятие';

  let text = byAdmin
    ? `Администратор записал вас на ${typeAcc} ${date}.`
    : `Вы успешно записались на ${typeAcc} ${date}.`;
  if (roleName) text += `\nРоль: ${roleName}.`;
  if (address) {
    text += `\nМесто проведения: ${address}`;
    if (yandexUrl) text += ` (${yandexUrl})`;
    text += '.';
  }
  text += `\n\nЕсли вы не записывались на ${typeAcc}, обратитесь к сотруднику отдела организации судейства.`;

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
        ${byAdmin ? 'Администратор записал вас' : 'Вы успешно записались'} на ${
          typeAcc
        } ${date} (МСК).
      </p>
      ${htmlRole}
      ${htmlAddress}
      <p style="font-size:12px;color:#777;margin:0;">
        Если вы не записывались на ${typeAcc}, обратитесь к сотруднику отдела организации судейства.
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderTrainingRegistrationEmail };
