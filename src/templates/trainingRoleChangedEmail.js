export function renderTrainingRoleChangedEmail(training, role, byAdmin = true) {
  const isCamp = training.TrainingType?.for_camp;
  const typePrep = isCamp ? 'тренировке' : 'мероприятии';
  const subject = `Изменена роль на ${typePrep}`;
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
  let text = byAdmin
    ? `Администратор изменил вашу роль на ${typePrep} ${date}.`
    : `Вы изменили свою роль на ${typePrep} ${date}.`;
  if (roleName) text += `\nНовая роль: ${roleName}.`;
  if (address) {
    text += `\nМесто проведения: ${address}`;
    if (yandexUrl) text += ` (${yandexUrl})`;
    text += '.';
  }
  const htmlRole = roleName
    ? `<p style="font-size:16px;margin:0 0 16px;">Новая роль: ${roleName}.</p>`
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
        ${byAdmin ? 'Администратор изменил вашу роль' : 'Вы изменили свою роль'} на ${
          typePrep
        } ${date} (МСК).
      </p>
      ${htmlRole}
      ${htmlAddress}
    </div>`;
  return { subject, text, html };
}

export default { renderTrainingRoleChangedEmail };
