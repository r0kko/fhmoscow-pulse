export function renderTrainingRegistrationCancelledEmail(training) {
  const isCamp = training.TrainingType?.for_camp;
  const typeAcc = isCamp ? 'тренировку' : 'мероприятие';
  const subject = `Запись на ${typeAcc} отменена`;
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
  const text = `Администратор отменил вашу запись на ${typeAcc} ${date}.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Администратор отменил вашу запись на ${typeAcc} ${date} (МСК).
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderTrainingRegistrationCancelledEmail };
