export function renderTrainingRegistrationSelfCancelledEmail(training) {
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
  const subject = 'Запись на тренировку отменена';
  const text = `Вы отменили свою запись на тренировку ${date}.`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Вы отменили свою запись на тренировку ${date} (МСК).
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderTrainingRegistrationSelfCancelledEmail };
