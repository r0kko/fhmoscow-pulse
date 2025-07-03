export function renderTrainingRegistrationEmail(training) {
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
  const subject = 'Запись на тренировку подтверждена';
  const text =
    `Вы успешно записались на тренировку ${date}.\n\n` +
    'Если вы не записывались на тренировку, просто проигнорируйте письмо.';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p style="font-size:16px;margin:0 0 16px;">Здравствуйте!</p>
      <p style="font-size:16px;margin:0 0 16px;">
        Вы успешно записались на тренировку ${date} (МСК).
      </p>
      <p style="font-size:12px;color:#777;margin:0;">
        Если вы не записывались на тренировку, просто проигнорируйте письмо.
      </p>
    </div>`;
  return { subject, text, html };
}

export default { renderTrainingRegistrationEmail };
